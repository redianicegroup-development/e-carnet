/* Version déployée, lue par Paramètres › Version de l'application pour savoir si l'appareil fait tourner du code plus ancien.
   Publique et sans donnée personnelle. Le fichier route prime sur la réécriture /api/* vers Django. */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { version: process.env.NEXT_PUBLIC_APP_VERSION || "dev", build: process.env.NEXT_PUBLIC_BUILD_ID || "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
