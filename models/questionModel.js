const mongoose = require("mongoose");
const questionSchema = new mongoose.Schema({
  question: String,
  yes: Number,
  no: Number,
});

const Question = mongoose.model("Question", questionSchema);
module.exports = Question;
