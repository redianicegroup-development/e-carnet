"""Réduction de taille PDF strictement sans réencodage avec perte.

La compression s'applique seulement aux PDF téléversés comme documents médicaux. Les fichiers signés,
chiffrés, mal formés, non compressibles ou si qpdf échoue restent byte pour byte inchangés.
"""
import logging
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)
PDF_MAGIC = b"%PDF-"
# Réécrire un PDF signé invalide son ByteRange. On privilégie alors l'intégrité de la signature à la taille.
_SIGNATURE_MARKER = re.compile(rb"/(?:ByteRange\s*\[|Type\s*/Sig\b|FT\s*/Sig\b)")
# Ne pas retirer ni altérer la protection par mot de passe/permissions d'un document chiffré.
_ENCRYPTION_MARKER = re.compile(rb"/Encrypt\b")
COMPRESSION_TIMEOUT_SECONDS = 8
VALIDATION_TIMEOUT_SECONDS = 4


def compress_pdf_lossless(original: bytes) -> bytes:
    """Recompresse les flux PDF Flate avec qpdf; rend l'original si le résultat n'est pas sûr et plus petit."""
    if not isinstance(original, bytes) or not original.startswith(PDF_MAGIC):
        return original
    if _SIGNATURE_MARKER.search(original) or _ENCRYPTION_MARKER.search(original):
        logger.info("PDF lossless compression skipped: signed or encrypted file")
        return original
    qpdf = shutil.which("qpdf")
    if not qpdf:
        logger.warning("PDF lossless compression skipped: qpdf is not installed")
        return original

    try:
        with tempfile.TemporaryDirectory(prefix="ecarnet-pdf-") as temporary_directory:
            source = Path(temporary_directory) / "source.pdf"
            target = Path(temporary_directory) / "optimized.pdf"
            source.write_bytes(original)
            result = subprocess.run(
                [
                    qpdf,
                    str(source),
                    "--stream-data=compress",
                    "--recompress-flate",
                    "--compression-level=9",
                    str(target),
                ],
                capture_output=True,
                timeout=COMPRESSION_TIMEOUT_SECONDS,
                check=False,
            )
            if result.returncode != 0 or not target.is_file():
                logger.warning("PDF lossless compression skipped: qpdf conversion failed (exit=%s)", result.returncode)
                return original
            optimized = target.read_bytes()
            if not optimized.startswith(PDF_MAGIC):
                logger.warning("PDF lossless compression skipped: qpdf output is not a PDF")
                return original
            checked = subprocess.run(
                [qpdf, "--check", str(target)],
                capture_output=True,
                timeout=VALIDATION_TIMEOUT_SECONDS,
                check=False,
            )
            if checked.returncode != 0:
                logger.warning("PDF lossless compression skipped: qpdf output validation failed (exit=%s)", checked.returncode)
                return original
            return optimized if len(optimized) < len(original) else original
    except (OSError, subprocess.SubprocessError) as exc:
        # L'upload du document original doit rester possible même si la compression est indisponible ou expirée.
        logger.warning("PDF lossless compression skipped after qpdf error (%s)", type(exc).__name__)
        return original
