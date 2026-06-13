const express = require('express');
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');

dotenv.config();
const uri =process.env.MONGODB_URI;
const app = express();
const port = process.env.PORT;



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});