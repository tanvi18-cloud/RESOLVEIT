require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'your-frontend-domain.com' : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use('/frontend', express.static('frontend'));

// Serve the frontend at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/resolveit');

// Schema and model
const querySchema = new mongoose.Schema({
  query: String,
  answer: String,
});

const Query = mongoose.model('Query', querySchema);

// User/Party Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: Number,
  gender: String,
  address: {
    street: String,
    city: String,
    zip: String,
  },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  photo: String, // store file path or URL
});

const User = mongoose.model('User', userSchema);

// Case Schema
const caseSchema = new mongoose.Schema({
  caseType: { type: String, required: true },
  issueDescription: { type: String, required: true },
  party: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  oppositeParty: {
    name: String,
    contact: String,
    address: String,
    hasAccepted: { type: Boolean, default: false },
    notifiedAt: Date,
    responseDeadline: Date
  },
  proof: [String],
  courtPending: {
    isPending: Boolean,
    caseNumber: String,
    firNumber: String,
    courtOrPoliceName: String,
  },
  status: { type: String, default: 'Queued' },
  witnesses: [
    {
      name: String,
      contact: String,
      role: String, // e.g., 'Party', 'Opposite Party'
      nominatedBy: String // 'party' or 'oppositeParty'
    }
  ],
  panel: [
    {
      name: String,
      expertise: String, // e.g., 'Lawyer', 'Religious Scholar', 'Community Member'
      contact: String,
      assignedAt: { type: Date, default: Date.now }
    }
  ],
  mediationSessions: [
    {
      scheduledAt: Date,
      status: String, // 'scheduled', 'completed', 'cancelled'
      notes: String,
      attendees: [String]
    }
  ],
  resolution: {
    isResolved: { type: Boolean, default: false },
    agreement: String,
    resolvedAt: Date,
    satisfactionLevel: Number // 1-5 rating
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Case = mongoose.model('Case', caseSchema);

// Route to store unanswered query (already handled by chatbot, if needed)
// app.post('/api/unanswered', async (req, res) => {
//   const { query } = req.body;
//   const newQuery = new Query({ query, answer: '' });
//   await newQuery.save();
//   res.json({ message: 'Unanswered query saved!' });
// });

// ✅ New Route to store admin’s answer
app.post('/api/admin-answer', async (req, res) => {
  const { query, answer } = req.body;
  try {
    let existing = await Query.findOne({ query });

    if (existing) {
      existing.answer = answer;
      await existing.save();
    } else {
      const newQA = new Query({ query, answer });
      await newQA.save();
    }

    res.status(200).json({ message: 'Answer saved successfully!' });
  } catch (err) {
    res.status(500).json({ error: 'Error saving answer' });
  }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^\d{10,15}$/.test(phone); // Adjust length as needed
}

const sanitize = (str) => {
  if (typeof str === 'string') {
    return str.replace(/[<>$]/g, '');
  }
  return str;
}

// Example usage in user registration:
app.post('/api/register-user', async (req, res) => {
  try {
    const { name, age, gender, address, email, phone, photo } = req.body;

    // Sanitize inputs
    const sanitizedName = sanitize(name);
    const sanitizedEmail = sanitize(email);
    const sanitizedPhone = sanitize(phone);
    const sanitizedPhoto = sanitize(photo);

    // Required fields check
    if (!name || !age || !gender || !address || !email || !phone) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    // Age validation
    if (typeof age !== 'number' || age <= 0) {
      return res.status(400).json({ error: 'Age must be a positive number.' });
    }
    // Gender validation
    const allowedGenders = ['Male', 'Female', 'Other'];
    if (!allowedGenders.includes(gender)) {
      return res.status(400).json({ error: 'Gender must be Male, Female, or Other.' });
    }
    // Address validation
    if (
      !address.street ||
      !address.city ||
      !address.zip
    ) {
      return res.status(400).json({ error: 'Complete address is required.' });
    }
    // Email and phone validation
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number.' });
    }
    // Unique email check
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const user = new User({
      name: sanitizedName,
      age,
      gender,
      address: {
        street: sanitize(address.street),
        city: sanitize(address.city),
        zip: sanitize(address.zip),
      },
      email: sanitizedEmail,
      phone: sanitizedPhone,
      photo: sanitizedPhoto,
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully!', user });
  } catch (err) {
    res.status(400).json({ error: 'Error registering user', details: err.message });
  }
});

app.post('/api/register-case', async (req, res) => {
  try {
    const {
      caseType,
      issueDescription,
      partyId,
      oppositeParty,
      proof,
      courtPending
    } = req.body;

    // Required fields check
    if (!caseType || !issueDescription || !partyId || !oppositeParty) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    // Case type validation
    const allowedTypes = ['Family', 'Business', 'Criminal'];
    if (!allowedTypes.includes(caseType)) {
      return res.status(400).json({ error: 'Invalid case type.' });
    }
    // Issue description validation
    if (typeof issueDescription !== 'string' || issueDescription.trim() === '') {
      return res.status(400).json({ error: 'Issue description is required.' });
    }
    // Opposite party validation
    if (
      !oppositeParty.name ||
      !oppositeParty.contact ||
      !oppositeParty.address
    ) {
      return res.status(400).json({ error: 'Complete opposite party details are required.' });
    }
    // Proof validation
    if (proof && !Array.isArray(proof)) {
      return res.status(400).json({ error: 'Proof must be an array.' });
    }
    // Court pending validation
    if (courtPending) {
      if (
        typeof courtPending.isPending !== 'boolean' ||
        (courtPending.isPending &&
          (!courtPending.caseNumber || !courtPending.courtOrPoliceName))
      ) {
        return res.status(400).json({ error: 'Court/police info is incomplete.' });
      }
    }

    // Check if user exists
    const user = await User.findById(partyId);
    if (!user) {
      return res.status(404).json({ error: 'Party (user) not found.' });
    }

    // Case verification logic
    let verificationStatus = 'Not Pending';
    if (courtPending && courtPending.isPending) {
      verificationStatus = `Pending in ${courtPending.courtOrPoliceName} (Case/FIR: ${courtPending.caseNumber || courtPending.firNumber})`;
    }

    // Set notification deadline (7 days from now)
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 7);

    const newCase = new Case({
      caseType,
      issueDescription,
      party: partyId,
      oppositeParty: {
        ...oppositeParty,
        notifiedAt: new Date(),
        responseDeadline
      },
      proof,
      courtPending,
      status: 'Queued'
    });

    await newCase.save();

    // Simulate automatic status change to "Awaiting Response" after notification
    setTimeout(async () => {
      await Case.findByIdAndUpdate(newCase._id, { 
        status: 'Awaiting Response',
        updatedAt: new Date()
      });
      
      // Emit real-time update
      io.emit('caseStatusUpdate', {
        caseId: newCase._id,
        status: 'Awaiting Response',
        notification: true
      });
    }, 2000); // 2 seconds delay to simulate notification process

    res.status(201).json({
      message: 'Case registered successfully!',
      case: newCase,
      verificationStatus,
      notification: `Opposite party ${oppositeParty.name} will be notified for mediation. Response deadline: ${responseDeadline.toLocaleDateString()}`
    });
  } catch (err) {
    res.status(400).json({ error: 'Error registering case', details: err.message });
  }
});

// Middleware to check admin token
function isAdmin(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Protect dashboard endpoints
app.get('/api/cases', isAdmin, async (req, res) => {
  try {
    const { status, caseType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (caseType) filter.caseType = caseType;
    const cases = await Case.find(filter).populate('party');
    res.json(cases);
  } catch (err) {
    res.status(400).json({ error: 'Error fetching cases', details: err.message });
  }
});

// Dashboard Statistics API (Public - no authentication required)
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const totalCases = await Case.countDocuments();
    const queuedCases = await Case.countDocuments({ status: 'Queued' });
    const awaitingResponse = await Case.countDocuments({ status: 'Awaiting Response' });
    const panelCreated = await Case.countDocuments({ status: 'Panel Created' });
    const inProgress = await Case.countDocuments({ status: 'Mediation in Progress' });
    const resolved = await Case.countDocuments({ 'resolution.isResolved': true });
    const unresolved = await Case.countDocuments({ status: 'Unresolved' });

    const casesByType = await Case.aggregate([
      { $group: { _id: '$caseType', count: { $sum: 1 } } }
    ]);

    res.json({
      totalCases,
      statusDistribution: {
        queued: queuedCases,
        awaitingResponse,
        panelCreated,
        inProgress,
        resolved,
        unresolved
      },
      casesByType: casesByType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    });
  } catch (err) {
    res.status(400).json({ error: 'Error fetching statistics', details: err.message });
  }
});

// Opposite Party Response API
app.post('/api/case/:id/opposite-party-response', async (req, res) => {
  try {
    const { accepted, reason } = req.body;
    const caseId = req.params.id;

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        'oppositeParty.hasAccepted': accepted,
        status: accepted ? 'Accepted' : 'Rejected',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Emit real-time update
    io.emit('caseStatusUpdate', {
      caseId,
      status: updatedCase.status,
      oppositePartyResponse: accepted
    });

    res.json({
      message: `Opposite party has ${accepted ? 'accepted' : 'rejected'} mediation`,
      case: updatedCase
    });
  } catch (err) {
    res.status(400).json({ error: 'Error processing response', details: err.message });
  }
});

// Schedule Mediation Session
app.post('/api/case/:id/schedule-mediation', isAdmin, async (req, res) => {
  try {
    const { scheduledAt, attendees } = req.body;
    const caseId = req.params.id;

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        $push: {
          mediationSessions: {
            scheduledAt: new Date(scheduledAt),
            status: 'scheduled',
            attendees
          }
        },
        status: 'Mediation in Progress',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Emit real-time update
    io.emit('caseStatusUpdate', {
      caseId,
      status: 'Mediation in Progress',
      mediationScheduled: true
    });

    res.json({
      message: 'Mediation session scheduled successfully',
      case: updatedCase
    });
  } catch (err) {
    res.status(400).json({ error: 'Error scheduling mediation', details: err.message });
  }
});

// Resolve Case
app.post('/api/case/:id/resolve', isAdmin, async (req, res) => {
  try {
    const { agreement, satisfactionLevel } = req.body;
    const caseId = req.params.id;

    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      {
        'resolution.isResolved': true,
        'resolution.agreement': agreement,
        'resolution.resolvedAt': new Date(),
        'resolution.satisfactionLevel': satisfactionLevel,
        status: 'Resolved',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Emit real-time update
    io.emit('caseStatusUpdate', {
      caseId,
      status: 'Resolved',
      resolved: true
    });

    res.json({
      message: 'Case resolved successfully',
      case: updatedCase
    });
  } catch (err) {
    res.status(400).json({ error: 'Error resolving case', details: err.message });
  }
});

app.patch('/api/case/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await Case.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Case status updated!', case: updated });
  } catch (err) {
    res.status(400).json({ error: 'Error updating status', details: err.message });
  }
});

app.patch('/api/case/:id/witnesses', isAdmin, async (req, res) => {
  try {
    const { witnesses } = req.body; // Array of witnesses
    const updated = await Case.findByIdAndUpdate(
      req.params.id,
      { $push: { witnesses: { $each: witnesses } } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'Witnesses nominated!', case: updated });
  } catch (err) {
    res.status(400).json({ error: 'Error nominating witnesses', details: err.message });
  }
});

app.patch('/api/case/:id/panel', isAdmin, async (req, res) => {
  try {
    const { panel } = req.body; // Array of panel members
    
    // Validate panel composition - must have lawyer, religious scholar, and community member
    const expertiseTypes = panel.map(member => member.expertise.toLowerCase());
    const hasLawyer = expertiseTypes.some(exp => exp.includes('lawyer'));
    const hasReligiousScholar = expertiseTypes.some(exp => exp.includes('religious') || exp.includes('scholar'));
    const hasCommunityMember = expertiseTypes.some(exp => exp.includes('community'));

    if (!hasLawyer || !hasReligiousScholar || !hasCommunityMember) {
      return res.status(400).json({ 
        error: 'Panel must include at least one lawyer, one religious scholar, and one community member' 
      });
    }

    const updated = await Case.findByIdAndUpdate(
      req.params.id,
      { $set: { panel }, status: 'Panel Created', updatedAt: new Date() },
      { new: true }
    );
    
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    
    // Emit real-time update
    io.emit('caseStatusUpdate', {
      caseId: req.params.id,
      status: 'Panel Created',
      panelCreated: true
    });
    
    res.json({ message: 'Panel created!', case: updated });
  } catch (err) {
    res.status(400).json({ error: 'Error creating panel', details: err.message });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

app.post('/api/upload-proof', upload.array('proof', 5), (req, res) => {
  try {
    const files = req.files.map(file => file.path);
    res.status(200).json({ message: 'Files uploaded!', files });
  } catch (err) {
    res.status(400).json({ error: 'Error uploading files', details: err.message });
  }
});

app.post('/api/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    if (username === adminUsername && password === adminPassword) {
      const token = jwt.sign(
        { id: 'admin', role: 'admin' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '24h' }
      );
      
      res.json({ 
        success: true, 
        token,
        message: 'Login successful'
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Login error',
      details: err.message 
    });
  }
});

// Get all users (for case registration dropdown)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({ name: { $ne: "Tanvi Patel" } }, 'name email phone _id');
    res.json(users);
  } catch (err) {
    res.status(400).json({ error: 'Error fetching users', details: err.message });
  }
});

// Get single case details
app.get('/api/case/:id', async (req, res) => {
  try {
    const caseData = await Case.findById(req.params.id).populate('party');
    if (!caseData) {
      return res.status(404).json({ error: 'Case not found' });
    }
    res.json(caseData);
  } catch (err) {
    res.status(400).json({ error: 'Error fetching case', details: err.message });
  }
});

// Update case status with automatic workflow
app.patch('/api/case/:id/workflow-status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const caseId = req.params.id;
    
    const validStatuses = [
      'Queued',
      'Awaiting Response', 
      'Accepted',
      'Rejected',
      'Panel Created',
      'Mediation in Progress',
      'Resolved',
      'Unresolved'
    ];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updated = await Case.findByIdAndUpdate(
      caseId,
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!updated) return res.status(404).json({ error: 'Case not found' });
    
    // Emit real-time update
    io.emit('caseStatusUpdate', {
      caseId,
      status,
      workflowUpdate: true
    });
    
    res.json({ message: 'Case status updated!', case: updated });
  } catch (err) {
    res.status(400).json({ error: 'Error updating status', details: err.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('joinCase', (caseId) => {
    socket.join(`case_${caseId}`);
    console.log(`Client ${socket.id} joined case ${caseId}`);
  });
  
  socket.on('joinDashboard', () => {
    socket.join('dashboard');
    console.log(`Client ${socket.id} joined dashboard`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
