const mongoose = require('mongoose');

const detailProductSchema = new mongoose.Schema({
    color: String,
    price: Number,
});

const productSchema = new mongoose.Schema({
    _id: String,
    productName: String,
    quantity: Number,
    detailProduct: detailProductSchema,
});

const orderSchema = new mongoose.Schema({
    creationDate: { type: Date, default: Date.now },
    products: [productSchema],
});

module.exports = mongoose.model('Order', orderSchema);
