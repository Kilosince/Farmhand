import nodemailer from 'nodemailer';
import path from 'path';

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false,
  },
});

const sendVerificationEmail = async (email, code) => {
  try {
    // Define the base URL based on environment (development or production)
    const baseUrl = process.env.NODE_ENV === 'production' ? "https://editfarmer.com" : "http://localhost:3000";

    // ✅ Make sure mailOptions is declared properly BEFORE use
    let mailOptions = {
      from: '"The Flying Pot" <info@theflyingpot.org>',
      to: email,
      subject: 'Email Verification',
      html: `
        <div style="text-align: center;">
          <h2>Hello, Farmer!</h2>
          <p>Your verification code is: <b>${code}</b></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};


const sendPurchaseEmail = async (email, storeName, ccName, cartTotal, items, timestamp) => {
  if (!Array.isArray(items)) {
    console.error('Items is not an array:', items);
    return;
  }

  items.forEach((item, index) => {
    if (!item.itemName || !item.price || !item.quantity) {
      console.error(`Item at index ${index} is missing itemName, price, or quantity:`, item);
    }
  });

  let itemDetails = items.map(item => `<li>${item.itemName}: $${item.price} (Quantity: ${item.quantity})</li>`).join('');

  let mailOptions = {
    from: '"The Flying Pot" <info@theflyingpot.org>',
    to: email,
    subject: 'Thank You for Your Purchase!',
    html: `
      <h1>Thank You for Your Purchase!</h1>
      <p>Store: ${storeName}</p>
      <p>Name: ${ccName}</p>
      <p>Total: $${cartTotal}</p>
      <p>Time of Purchase: ${timestamp}</p>
      <ul>${itemDetails}</ul>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Purchase email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SMTP response:', error.response);
    }
  }
};

export { sendVerificationEmail, sendPurchaseEmail };