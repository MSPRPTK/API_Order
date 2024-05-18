const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const ordersRouter = require('./routes/orderRoute');
const app = express();
const port = process.env.PORT || 4400;

app.listen(port, () => {
   console.log(`Server is running on port ${port}`);
});

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/orders', ordersRouter);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb://mongodb:27017/db_order')
   .then(() => {
       console.log('Connected to MongoDB');
   }).catch((error) => {
       console.error('Error connecting to MongoDB', error);
   });
