import express from 'express';
import { check, validationResult } from 'express-validator';
import bcryptjs from 'bcryptjs';
import multer from 'multer'; // Import multer for handling file uploads
import { ObjectId } from 'mongodb';
import connectToDatabase from './db/connection.js';
import jwt from 'jsonwebtoken';
import { sendVerificationEmail } from './src/emailService.js';
import "@aws-sdk/crc64-nvme-crt";
//restart
const router = express.Router();

async function getCollection() {
  const db = await connectToDatabase();
  return db.collection('video_hero_users');
}

// Middleware to authenticate the request using JWT.
const authenticateUser = async (req, res, next) => {
  const token = req.cookies.token || req.header('Authorization').replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Access Denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const collection = await getCollection();
    const user = await collection.findOne({ _id: new ObjectId(decoded.id) });

    if (!user) {
      return res.status(401).json({ message: 'Access Denied. Invalid token.' });
    }

    req.currentUser = user;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};


// Route to check if email or username exists
router.post('/check-user', async (req, res) => {
  const { email, username } = req.body;

  try {
    const collection = await getCollection();
    const emailExists = await collection.findOne({ email });
    const usernameExists = await collection.findOne({ username });

    if (emailExists || usernameExists) {
      return res.status(400).json({
        errors: {
          ...(emailExists && { email: 'Email already in use' }),
          ...(usernameExists && { username: 'Username already in use' }),
        },
      });
    }

    res.status(200).json({ message: 'Email and username are available' });
  } catch (error) {
    res.status(500).json({ errors: { server: 'Internal server error' } });
  }
});


router.post('/send-verification-code', async (req, res) => {
  const { email, code } = req.body;

  try {
    await sendVerificationEmail(email, code);
    res.status(200).json({ message: 'Verification email sent.' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending verification email. Please try again.' });
  }
});

// Route to create or update a user
router.post('/users/add', [
  check('name').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "name"'),
  check('username').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "username"'),
  check('password').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "password"'),
  check('email').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "email"'),
  check('kind').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "kind"'),
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({ errors: errorMessages });
  }

  const { name, username, password, email, kind, code } = req.body;
  const hashedPassword = bcryptjs.hashSync(password);

  try {
    const collection = await getCollection();
    const user = await collection.findOne({ email });

    if (user) {
      if (user.verified) {
        return res.status(400).json({ message: 'User already verified.' });
      }

      await collection.updateOne({ email }, { $set: { name, username, password: hashedPassword, kind, verified: true } });
      return res.status(201).json({ message: 'User updated and verified.' });
    } else {
      const newUser = { name, username, password: hashedPassword, email, kind, verified: true };
      await collection.insertOne(newUser);
      return res.status(201).json({ message: 'User created and verified.' });
    }
  } catch (error) {
    return res.status(500).json({ message: 'Error creating or updating user. Please try again.' });
  }
});

// Route to sign in
router.post('/signin', [
  check('email').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "email"'),
  check('password').exists({ checkNull: true, checkFalsy: true }).withMessage('Please provide a value for "password"'),
], async (req, res) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({ errors: errorMessages });
  }

  const { email, password } = req.body;

  const collection = await getCollection();
  const user = await collection.findOne({ email });

  if (!user || !bcryptjs.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Authentication failure: Invalid email or password' });
  }

  if (!user.verified) {
    return res.status(403).json({ message: 'Please verify your email before signing in' });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.cookie('token', token, { httpOnly: true });

  return res.status(200).json({ message: 'Sign-in successful', user, token });
});

// Route that returns the current authenticated user.
router.get('/users', authenticateUser, (req, res) => {
  const user = req.currentUser;

  res.json({
    name: user.name,
    username: user.username,
  });
});

// Delete user route
router.delete('/users/:userId', async (req, res) => {
  const { userId } = req.params;

  console.log(`Received request to delete user with ID: ${userId}`); // Debugging line

  try {
    const collection = await getCollection(); // Ensure this function retrieves the correct collection

    if (!ObjectId.isValid(userId)) {
      return res.status(400).send('Invalid user ID');
    }

    // Delete the user
    const result = await collection.deleteOne({ _id: new ObjectId(userId) });

    if (result.deletedCount === 1) {
      res.status(200).send('User deleted successfully');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).send('Internal server error');
  }
});


export default router;
