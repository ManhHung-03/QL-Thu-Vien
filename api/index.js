const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { Book, Checkout, Distribution, System, AuditLog, Notification } = require('./models');

const app = express();

// Increase JSON limit for base64 image covers
app.use(express.json({ limit: '10mb' }));
app.use(cors());

let isConnected = false;

const connectDB = async () => {
    if (isConnected) return;
    
    if (!process.env.MONGODB_URI) {
        console.warn('MONGODB_URI is not defined. Using memory temporarily or skipping DB ops.');
        return;
    }
    
    try {
        const db = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000
        });
        isConnected = db.connections[0].readyState === 1;
        console.log('MongoDB connected successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
    }
};

// Middleware to ensure DB connection
app.use(async (req, res, next) => {
    await connectDB();
    if (!isConnected) {
        return res.status(503).json({ error: 'Database connection not established. Check MONGODB_URI.' });
    }
    next();
});

// GET all data (For initialization)
app.get('/api/data', async (req, res) => {
    try {
        const [books, checkouts, distributions, auditLogs, notifications, sysConfig] = await Promise.all([
            Book.find({}),
            Checkout.find({}),
            Distribution.find({}),
            AuditLog.find({}).sort({ time: -1 }).limit(100),
            Notification.find({}).sort({ date: -1 }),
            System.find({})
        ]);

        const rules = sysConfig.find(s => s.key === 'rules')?.value || { maxBorrow: 3 };
        const genres = sysConfig.find(s => s.key === 'genres')?.value || ['Công nghệ', 'Văn học', 'Kinh tế', 'Khoa học', 'Kỹ năng sống'];
        const departments = sysConfig.find(s => s.key === 'departments')?.value || ['Phòng Kỹ thuật', 'Phòng Hành chính', 'Phòng Kế toán', 'Phòng Đào tạo', 'Phòng Nhân sự'];

        res.json({
            books,
            checkouts,
            distributions,
            auditLogs,
            notifications,
            rules,
            genres,
            departments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST sync data (Migration from LocalStorage)
app.post('/api/sync', async (req, res) => {
    try {
        const { books, checkouts, distributions, auditLogs, notifications, rules, genres, departments } = req.body;
        
        // Check if DB is already populated to avoid duplicate syncs
        const existingBooks = await Book.countDocuments();
        if (existingBooks > 0) {
            return res.json({ message: 'Database is already populated. Migration skipped.' });
        }

        if (books && books.length > 0) await Book.insertMany(books);
        if (checkouts && checkouts.length > 0) await Checkout.insertMany(checkouts);
        if (distributions && distributions.length > 0) await Distribution.insertMany(distributions);
        if (auditLogs && auditLogs.length > 0) await AuditLog.insertMany(auditLogs);
        if (notifications && notifications.length > 0) await Notification.insertMany(notifications);

        if (rules) await System.findOneAndUpdate({ key: 'rules' }, { key: 'rules', value: rules }, { upsert: true });
        if (genres) await System.findOneAndUpdate({ key: 'genres' }, { key: 'genres', value: genres }, { upsert: true });
        if (departments) await System.findOneAndUpdate({ key: 'departments' }, { key: 'departments', value: departments }, { upsert: true });

        res.json({ success: true, message: 'Data synced successfully to MongoDB!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk replace a collection (for optimistic UI syncing)
app.post('/api/bulk/:key', async (req, res) => {
    try {
        const key = req.params.key;
        const data = req.body;
        
        switch(key) {
            case 'books':
                await Book.deleteMany({});
                if (data && data.length > 0) await Book.insertMany(data);
                break;
            case 'checkouts':
                await Checkout.deleteMany({});
                if (data && data.length > 0) await Checkout.insertMany(data);
                break;
            case 'distributions':
                await Distribution.deleteMany({});
                if (data && data.length > 0) await Distribution.insertMany(data);
                break;
            case 'auditLogs':
                await AuditLog.deleteMany({});
                if (data && data.length > 0) await AuditLog.insertMany(data);
                break;
            case 'notifications':
                await Notification.deleteMany({});
                if (data && data.length > 0) await Notification.insertMany(data);
                break;
            case 'rules':
            case 'genres':
            case 'departments':
                await System.findOneAndUpdate({ key }, { key, value: data }, { upsert: true });
                break;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Books API
app.post('/api/books', async (req, res) => {
    try {
        const book = new Book(req.body);
        await book.save();
        res.json(book);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/books/:id', async (req, res) => {
    try {
        const book = await Book.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        res.json(book);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/books/:id', async (req, res) => {
    try {
        await Book.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Checkouts API
app.post('/api/checkouts', async (req, res) => {
    try {
        const checkout = new Checkout(req.body);
        await checkout.save();
        
        // Update Book stock
        await Book.findOneAndUpdate(
            { id: req.body.bookId }, 
            { $inc: { quantity: -req.body.quantity, borrowedCount: req.body.quantity } }
        );
        res.json(checkout);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/checkouts/:id', async (req, res) => {
    try {
        const checkout = await Checkout.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
        // Handled in frontend for simplicity: We expect the frontend to send a separate PUT to books 
        // OR we just do it here if we know the diff. Since frontend handles state, we rely on the frontend PUT to /books.
        res.json(checkout);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Distributions API
app.post('/api/distributions', async (req, res) => {
    try {
        const dist = new Distribution(req.body);
        await dist.save();
        
        await Book.findOneAndUpdate(
            { id: req.body.bookId }, 
            { $inc: { quantity: -req.body.quantity } }
        );
        res.json(dist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// System settings & Categories
app.post('/api/system', async (req, res) => {
    try {
        const { key, value } = req.body;
        await System.findOneAndUpdate({ key }, { key, value }, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Audit Logs
app.post('/api/audit-logs', async (req, res) => {
    try {
        const log = new AuditLog(req.body);
        await log.save();
        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Notifications
app.post('/api/notifications', async (req, res) => {
    try {
        const noti = new Notification(req.body);
        await noti.save();
        res.json(noti);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id', async (req, res) => {
    try {
        const noti = await Notification.findOneAndUpdate({ id: req.params.id }, { unread: false }, { new: true });
        res.json(noti);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear collections (Factory Reset)
app.post('/api/reset', async (req, res) => {
    try {
        await Promise.all([
            Book.deleteMany({}),
            Checkout.deleteMany({}),
            Distribution.deleteMany({}),
            System.deleteMany({}),
            AuditLog.deleteMany({}),
            Notification.deleteMany({})
        ]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });
}

module.exports = app;
