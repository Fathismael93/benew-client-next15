'use server';

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendContactEmail(formData) {
  try {
    // Récupérer les données du formulaire
    const name = formData.get('name');
    const email = formData.get('email');
    const subject = formData.get('subject');
    const message = formData.get('message');

    // Validation basique
    if (!name || !email || !subject || !message) {
      return { success: false, error: 'Tous les champs sont requis' };
    }

    // Créer le contenu texte de l'email
    const textContent = `
NOUVEAU MESSAGE DE CONTACT
==========================

Informations de contact :
- Nom : ${name}
- Email : ${email}
- Sujet : ${subject}

Message :
---------
${message}

--
Ce message a été envoyé depuis votre formulaire de contact.
Vous pouvez répondre directement à cet email pour contacter ${name}.
    `;

    // Envoyer l'email
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', // Remplace par ton domaine vérifié
      to: ['fathismael@gmail.com'], // Remplace par ton email de réception
      subject: `[Contact] ${subject}`,
      text: textContent,
      replyTo: email, // L'email de l'expéditeur pour pouvoir lui répondre
    });

    return { success: true, data };
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error);
    return { success: false, error: "Erreur lors de l'envoi du message" };
  }
}
