import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    is_admin: Boolean
});

const User = mongoose.model('user', userSchema);

export { User, userSchema };