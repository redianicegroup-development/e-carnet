// Fonction serverless Vercel : reçoit le formulaire et envoie l'e-mail via Resend.
// La clé RESEND_API_KEY reste côté serveur (variable d'environnement), jamais dans le navigateur.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9 ().-]+$/;
const SUBJECTS = {
  question: "Une question sur Mon E-Carnet",
  patient: "Je suis patient : besoin d’aide",
  professional: "Je suis professionnel de santé",
  establishment: "Ouvrir un espace établissement",
  problem: "Signaler un problème",
  privacy: "Mes données personnelles",
  partnership: "Partenariat ou presse",
  other: "Autre demande",
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (s, max) => String(s || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
const hits = new Map(); // limite simple par IP (par instance)

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ error: "Service d'envoi non configuré." });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "inconnu";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ error: "Trop d'envois. Réessayez dans quelques minutes." });
  recent.push(now); hits.set(ip, recent);

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  if (b.website) return res.status(200).json({ ok: true }); // champ piège rempli : on ignore

  const prenom = clean(b.first_name, 80), nom = clean(b.last_name, 80);
  const contact = clean(b.contact, 254), subject = SUBJECTS[b.subject];
  const message = String(b.message || "").trim().slice(0, 2000);
  const contactIsEmail = EMAIL.test(contact);
  const digits = contact.replace(/\D/g, "").length;
  const contactIsPhone = PHONE.test(contact) && digits >= 8 && digits <= 15;
  if (b.consent !== true) return res.status(400).json({ error: "Le consentement est obligatoire." });
  if (prenom.length < 2 || nom.length < 2) return res.status(400).json({ error: "Merci d'indiquer votre prénom et votre nom." });
  if (!contactIsEmail && !contactIsPhone) return res.status(400).json({ error: "Adresse e-mail ou numéro de téléphone invalide." });
  if (!subject) return res.status(400).json({ error: "Choisissez l’objet de votre message." });
  if (message.length < 10) return res.status(400).json({ error: "Votre message est trop court." });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Redianice <onboarding@resend.dev>",
        to: [process.env.CONTACT_TO || "redianicegroup@gmail.com"],
        ...(contactIsEmail ? { reply_to: contact } : {}),
        subject: "Contact landing — " + subject + " — " + prenom + " " + nom,
        text: "Objet : " + subject + "\nContact : " + contact + "\nNom : " + prenom + " " + nom + "\n\n" + message,
        html: "<p><b>" + esc(prenom) + " " + esc(nom) + "</b></p><p>Contact : " + esc(contact) + "</p><p>Objet : " + esc(subject) + "</p><p>" + esc(message).replace(/\n/g, "<br>") + "</p>",
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "L’e-mail de notification n’a pas pu être envoyé." });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: "L’e-mail de notification n’a pas pu être envoyé." });
  }
};
