const express = require('express');
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion,ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");

dotenv.config();
const uri =process.env.MONGODB_URI;
const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

//middleware for verify jwt token
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;

    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    //await client.connect();

    const db = client.db("tutorsync");
    const tutorsCollection = db.collection("tutors");
    const bookingsCollection = db.collection("bookings");

   //fetch tutors data from client side and store in database
    app.post('/tutors', async (req, res) => {
          const tutor = req.body;
          const newTutor = {...tutor,
               hourlyFee: Number(tutor.hourlyFee),   
               totalSlot: Number(tutor.totalSlot),
               userId: tutor.userId,   
              createdAt: new Date(),
            };
          console.log(tutor);
          const result =await tutorsCollection.insertOne(newTutor);

          res.json(result);

    });

    //fetch tutors data from database and send to client side
    app.get('/tutors', async (req, res) => {
      const { search, startDate, endDate } = req.query;
      let query = {};
     //search by tutor name
      if (search) {
          query.name = { $regex: search, $options: "i" };
       }
      
       //date filtering for available tutors
       if (startDate) {
      query.startDate = {
      ...query.startDate,
      $gte: startDate,
    };
    }

    if (endDate) {
    query.startDate = {
      ...query.startDate,
      $lte: endDate,
    };
  }

      const result =await tutorsCollection.find(query).toArray()
          res.json(result);
    });


//show available tutors on home page with limit 6
    app.get("/available-tutors", async (req, res) => {
      const result = await tutorsCollection.find().limit(6).toArray()
      res.json(result)
    })


    //details page for each tutor
    app.get("/tutors/:id",verifyToken, async (req, res) => {
     const { id } = req.params;
     console.log(req.user);

      const tutor = await tutorsCollection.findOne({
        _id: new ObjectId(id),
         });
       res.json(tutor);
      });

      //booking a tutor
      app.post("/bookings", async (req, res) => {
      try {
           const booking = req.body;
           const tutor = await tutorsCollection.findOne({_id: new ObjectId(booking.tutorId),});

    
    const totalSlot = Number(tutor.totalSlot);
    if (totalSlot <= 0) {
      return res.status(400).json({
        message: "No available slots left.",
      });
    }

    const today = new Date();
    const sessionDate = new Date(tutor.startDate);

    if (today < sessionDate) {
      return res.status(400).json({
        message: "Booking is not available yet for this tutor.",
      });
    }

    const newBooking = {
      ...booking,
      bookStatus: "confirmed",
      createdAt: new Date(),
    };

    await bookingsCollection.insertOne(newBooking);

    //decrease the total slot of the tutor by 1 after successful booking
    await tutorsCollection.updateOne(
      { _id: tutor._id },
      { $inc: { totalSlot: -1 } }
    );

    res.json({
      message: "Booking successful ",
    });

  } catch (error) {
    console.log(error); 
    res.status(500).json({
      message: "Booking failed ",
    });
  }
});

//get all bookings for a specific user
app.get("/bookings/:email", async (req, res) => {
  const { email } = req.params;
  const result = await bookingsCollection.find({ studentEmail: email }).toArray();
  res.json(result);
});

//cancel a booking
app.patch("/bookings/:id", async (req, res) => {
      const { id } = req.params;

      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

      await bookingsCollection.updateOne(
         { _id: new ObjectId(id) },
         { $set: { bookStatus: "cancelled" } }
       );

      await tutorsCollection.updateOne(
        { _id: new ObjectId(booking.tutorId) },
        { $inc: { totalSlot: 1 } }
      );

      res.json({ message: "Booking cancelled ✅" });
    });

    //get tutors by user id
  app.get("/my-tutors/:userId", async (req, res) => {
  const { userId } = req.params;

  const result = await tutorsCollection
    .find({ userId })
    .toArray();

  res.json(result);
});

//update tutor information
app.patch("/tutors/:id",async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const result = await tutorsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Tutor not found" });
    }
    res.json({ message: "Tutor updated successfully" });

});

// delete a tutor
app.delete("/tutors/:id", async (req, res) => {
  const { id } = req.params;
  await tutorsCollection.deleteOne({ _id: new ObjectId(id) });
  res.json({ message: "Tutor deleted successfully" });
});



    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
       
  }
}


run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});