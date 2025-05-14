const mongoose = require('mongoose');

const LoginUserSchema = new mongoose.Schema(
  {
    username: { type: String, unique: true, required: true },
    // If you’re storing the hashed password in a field called "password",
    // use that. Otherwise rename to passwordHash if you already have hashes.
    password: { type: String, required: true }
  },
  {
    collection: 'loginUser'    // <-- explicitly point at your existing collection
  }
);

module.exports = mongoose.model('LoginUser', LoginUserSchema);