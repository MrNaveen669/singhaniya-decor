import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  User,
  Category,
  Product,
  Project,
  Testimonial,
  Setting,
} from './models.js';

import { auth } from './auth.js';

// ======================================================
// BASIC CONFIG
// ======================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// ======================================================
// REQUIRED ENV CHECK
// ======================================================

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not configured.');
}

// ======================================================
// MONGODB
// ======================================================

const mongoURI =
  process.env.MONGO_URI;

try {
  await mongoose.connect(mongoURI);
  console.log('MongoDB connected');
} catch (error) {
  console.error('MongoDB connection failed:', error.message);
  process.exit(1);
}

// ======================================================
// CORS
// ======================================================

const allowedOrigins = [
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin header
      // e.g. Render health checks, Postman, curl
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`Blocked by CORS: ${origin}`);

      return callback(
        new Error('This origin is not allowed by CORS')
      );
    },

    credentials: true,
  })
);

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan('dev'));

// ======================================================
// ROOT / HEALTH ROUTES
// ======================================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Singhaniya Decor API is running',
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
  });
});

// ======================================================
// UPLOAD DIRECTORY
// ======================================================

const uploads = path.join(__dirname, '../uploads');

fs.mkdirSync(uploads, {
  recursive: true,
});

app.use('/uploads', express.static(uploads));

// ======================================================
// MULTER CONFIG
// ======================================================

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploads);
  },

  filename: (req, file, callback) => {
    const safeName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      '-'
    );

    callback(
      null,
      `${Date.now()}-${safeName}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 8 * 1024 * 1024,
  },

  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      return callback(
        new Error('Only image files are allowed')
      );
    }

    callback(null, true);
  },
});

// ======================================================
// SLUG HELPER
// ======================================================

const createSlug = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// ======================================================
// AUTH
// ======================================================

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials',
      });
    }

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        message: 'Invalid credentials',
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },

      process.env.JWT_SECRET,

      {
        expiresIn: '7d',
      }
    );

    res.json({
      success: true,

      token,

      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ======================================================
// IMAGE UPLOAD
// ======================================================

app.post(
  '/api/upload',
  auth,
  upload.single('image'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        message: 'Image is required',
      });
    }

    res.status(201).json({
      success: true,
      url: `/uploads/${req.file.filename}`,
    });
  }
);

// ======================================================
// CRUD DEFINITIONS
// ======================================================

const resources = [
  ['categories', Category],
  ['products', Product],
  ['projects', Project],
  ['testimonials', Testimonial],
];

// ======================================================
// CRUD ROUTES
// ======================================================

for (const [route, Model] of resources) {

  // ----------------------------------------------------
  // GET ALL
  // ----------------------------------------------------

  app.get(`/api/${route}`, async (req, res, next) => {
    try {
      const query = {};

      // PRODUCT FILTERS
      if (route === 'products') {
        query.active = {
          $ne: false,
        };

        if (req.query.category) {
          query.category = req.query.category;
        }

        if (req.query.search) {
          query.name = {
            $regex: req.query.search,
            $options: 'i',
          };
        }

        if (req.query.featured === 'true') {
          query.featured = true;
        }
      }

      // TESTIMONIAL FILTER
      if (route === 'testimonials') {
        query.active = {
          $ne: false,
        };
      }

      let sort = {
        createdAt: -1,
      };

      if (route === 'categories') {
        sort = {
          order: 1,
        };
      }

      const documents = await Model.find(query).sort(sort);

      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  // ----------------------------------------------------
  // GET ONE
  // ----------------------------------------------------

  app.get(`/api/${route}/:id`, async (req, res, next) => {
    try {
      const identifier = req.params.id;

      const conditions = [
        {
          slug: identifier,
        },
      ];

      if (mongoose.isValidObjectId(identifier)) {
        conditions.unshift({
          _id: identifier,
        });
      }

      const document = await Model.findOne({
        $or: conditions,
      });

      if (!document) {
        return res.status(404).json({
          message: 'Not found',
        });
      }

      res.json(document);
    } catch (error) {
      next(error);
    }
  });

  // ----------------------------------------------------
  // CREATE
  // ----------------------------------------------------

  app.post(
    `/api/${route}`,
    auth,
    async (req, res, next) => {
      try {
        const body = {
          ...req.body,
        };

        if (
          (route === 'products' ||
            route === 'categories') &&
          !body.slug
        ) {
          body.slug = createSlug(body.name);
        }

        const document = await Model.create(body);

        res.status(201).json(document);
      } catch (error) {
        next(error);
      }
    }
  );

  // ----------------------------------------------------
  // UPDATE
  // ----------------------------------------------------

  app.put(
    `/api/${route}/:id`,
    auth,
    async (req, res, next) => {
      try {
        const body = {
          ...req.body,
        };

        if (
          (route === 'products' ||
            route === 'categories') &&
          !body.slug
        ) {
          body.slug = createSlug(body.name);
        }

        const document =
          await Model.findByIdAndUpdate(
            req.params.id,
            body,
            {
              new: true,
              runValidators: true,
            }
          );

        if (!document) {
          return res.status(404).json({
            message: 'Not found',
          });
        }

        res.json(document);
      } catch (error) {
        next(error);
      }
    }
  );

  // ----------------------------------------------------
  // DELETE
  // ----------------------------------------------------

  app.delete(
    `/api/${route}/:id`,
    auth,
    async (req, res, next) => {
      try {
        const document =
          await Model.findByIdAndDelete(
            req.params.id
          );

        if (!document) {
          return res.status(404).json({
            message: 'Not found',
          });
        }

        res.json({
          success: true,
        });
      } catch (error) {
        next(error);
      }
    }
  );
}

// ======================================================
// SETTINGS
// ======================================================

app.get('/api/settings', async (req, res, next) => {
  try {
    const rows = await Setting.find();

    const settings = Object.fromEntries(
      rows.map((item) => [
        item.key,
        item.value,
      ])
    );

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.put(
  '/api/settings',
  auth,
  async (req, res, next) => {
    try {
      for (const [key, value] of Object.entries(
        req.body
      )) {
        await Setting.findOneAndUpdate(
          {
            key,
          },

          {
            value,
          },

          {
            upsert: true,
            new: true,
          }
        );
      }

      res.json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ======================================================
// OPTIONAL FRONTEND SERVING
// ======================================================
//
// Render par agar frontend separate Static Site hai,
// normally ye section use nahi hoga.
//
// Local/single-service production build me useful hai.
//

const dist = path.join(
  __dirname,
  '../../client/dist'
);

if (fs.existsSync(dist)) {
  app.use(express.static(dist));

  // Express 5 compatibility:
  app.get('/{*splat}', (req, res, next) => {
    // API requests ko frontend index.html mat bhejo
    if (req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(
      path.join(dist, 'index.html')
    );
  });
}

// ======================================================
// API 404
// ======================================================

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found',
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((error, req, res, next) => {
  console.error(error);

  // Multer file size
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'Image must be smaller than 8 MB',
    });
  }

  // Mongo duplicate key
  if (error.code === 11000) {
    return res.status(409).json({
      message: 'This record already exists',
    });
  }

  // Invalid Mongo ID
  if (error.name === 'CastError') {
    return res.status(400).json({
      message: 'Invalid ID',
    });
  }

  res.status(500).json({
    success: false,
    message:
      error.message || 'Internal server error',
  });
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Singhaniya Decor API running on port ${PORT}`
  );
});