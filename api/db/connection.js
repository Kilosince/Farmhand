import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const uri = process.env.ATLAS_URI;
let client; // Declare the MongoClient instance outside of the function scope

async function connectToDatabase() {
  if (!client) {
    try {
      client = new MongoClient(uri);
      await client.connect();
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
      throw err;
    }
  }
  return client.db(process.env.DB_NAME);
}

export default connectToDatabase;