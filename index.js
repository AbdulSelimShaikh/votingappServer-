const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server: SocketServer } = require("socket.io");

const app = express();

// Middleware
app.use(
  cors({
    origin: "https://votingappclient.vercel.app", // Specify the client URL in production
  })
);
app.use(express.json()); // Parse JSON request body

const Server = http.createServer(app);
const PORT = 8000;

// Database Connection
require("./connection"); // Ensure the database is connected correctly

// Models
const Questions = require("./models/questionModel");

// Initialize Socket.io with CORS configuration
const io = new SocketServer(Server, {
  cors: {
    origin: "https://votingappclient.vercel.app", // Specify the client URL in production
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"], // Add headers if needed
  },
});

// Helper function to create a new vote
async function createNewVote(question) {
  try {
    const newVote = await Questions.create({
      question,
      yes: 0,
      no: 0,
    });
    console.log("New vote created:", newVote);
    return newVote;
  } catch (error) {
    console.error("Error while saving to DB:", error.message);
    throw new Error("Error while creating a new vote");
  }
}

// Helper function to update a vote
async function updateVote(id, answer) {
  try {
    const update = answer === 0 ? { no: 1 } : { yes: 1 };
    const result = await Questions.updateOne({ _id: id }, { $inc: update });
    console.log("Vote updated:", result);
    if (result.nModified === 0) {
      throw new Error("Vote not found or not updated");
    }
    return result;
  } catch (error) {
    console.error("Error while updating DB:", error.message);
    throw new Error("Error while updating a vote");
  }
}

// Create a new vote
app.post("/new-vote", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ msg: "Question is required" });
    }

    const newVote = await createNewVote(question);
    return res
      .status(201)
      .json({ msg: "Vote saved successfully", vote: newVote });
  } catch (error) {
    console.error("Error creating new vote:", error.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

// Get all votes
app.get("/getVotes", async (req, res) => {
  try {
    const questions = await Questions.find();
    return res.status(200).json(questions);
  } catch (error) {
    console.error("Error fetching votes:", error.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

// Delete a specific vote
app.delete("/delete-vote/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedVote = await Questions.findByIdAndDelete(id);

    if (!deletedVote) {
      return res.status(404).json({ msg: "Vote not found" });
    }

    return res
      .status(200)
      .json({ msg: "Vote deleted successfully", vote: deletedVote });
  } catch (error) {
    console.error("Error deleting vote:", error.message);
    return res.status(500).json({ msg: "Internal Server Error" });
  }
});

// Socket.io connection
io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Listen for incoming vote input
  socket.on("answer:input", async (data) => {
    try {
      console.log("Vote received:", data);
      await updateVote(data.id, data.answer);

      // Emit the updated vote to all connected clients
      const updatedVote = await Questions.findById(data.id);
      io.emit("answer:output", {
        id: data.id,
        yes: updatedVote.yes,
        no: updatedVote.no,
      });
    } catch (error) {
      console.error("Error processing vote input:", error.message);
    }
  });

  // Handle socket disconnection
  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Attach Socket.io to the server and start it
Server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
