const nodemailer = require('nodemailer');

let transporter;

const isConfigured = () => Boolean(
  process.env.SMTP_HOST
  && process.env.SMTP_PORT
  && process.env.SMTP_USER
  && process.env.SMTP_PASSWORD
  && process.env.EMAIL_FROM
);

const getTransporter = () => {
  if (!isConfigured()) {
    throw new Error('Configuration SMTP incomplète');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  return transporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || (!html && !text)) {
    throw new Error('Destinataire, sujet et contenu email obligatoires');
  }

  const info = await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });

  return {
    accepted: info.accepted,
    messageId: info.messageId,
  };
};

const resetTransporter = () => {
  transporter = undefined;
};

module.exports = { sendEmail, resetTransporter };
