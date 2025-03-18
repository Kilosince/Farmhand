import express from 'express';
import connectToDatabase from './db/connection.js';


const router = express.Router();

async function getCollection() {
  const db = await connectToDatabase();
  return db.collection('video_hero_users');
}

router.post('/check-user', async (req, res) => {
    const { email, username } = req.body;
  
    try {
      const usersCollection = await getCollection();
      
      const emailExists = await usersCollection.findOne({ email });
      const usernameExists = await usersCollection.findOne({ username });
  
      if (emailExists || usernameExists) {
        return res.status(400).json({
          errors: {
            email: emailExists ? 'Email already in use' : null,
            username: usernameExists ? 'Username already in use' : null,
          },
        });
      }
  
      res.status(200).json({ message: 'Email and username are available' });
    } catch (error) {
      res.status(500).json({ errors: { server: 'Internal server error' } });
    }
  });
  
  export default router;