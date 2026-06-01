const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    genre: { type: String, required: true },
    importDate: { type: String },
    quantity: { type: Number, default: 0 },
    notes: { type: String },
    cover: { type: String }, // Base64 string
    borrowedCount: { type: Number, default: 0 },
    status: { type: String }
});

const checkoutSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    memberName: { type: String, required: true },
    memberDepartment: { type: String },
    bookId: { type: String, required: true },
    bookTitle: { type: String, required: true },
    borrowDate: { type: String },
    quantity: { type: Number, default: 1 },
    returnedQuantity: { type: Number, default: 0 },
    returnEvents: [{
        date: String,
        quantity: Number,
        returnerName: String,
        returnerDepartment: String,
        condition: String,
        notes: String
    }],
    returnDate: { type: String, default: null },
    status: { type: String },
    notes: { type: String }
});

const distributionSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    bookId: { type: String, required: true },
    bookTitle: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    receiverName: { type: String, required: true },
    receiverDepartment: { type: String, required: true },
    receiveDate: { type: String },
    notes: { type: String }
});

const systemSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed }
});

const auditLogSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    actor: { type: String },
    action: { type: String },
    time: { type: String },
    type: { type: String }
});

const notificationSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    memberId: { type: String },
    message: { type: String },
    date: { type: String },
    unread: { type: Boolean, default: true },
    type: { type: String }
});

module.exports = {
    Book: mongoose.models.Book || mongoose.model('Book', bookSchema),
    Checkout: mongoose.models.Checkout || mongoose.model('Checkout', checkoutSchema),
    Distribution: mongoose.models.Distribution || mongoose.model('Distribution', distributionSchema),
    System: mongoose.models.System || mongoose.model('System', systemSchema),
    AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema),
    Notification: mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
};
