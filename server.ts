import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import knex from 'knex';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

async function startServer() {
  const logs: string[] = [];
  const logLimit = 100;
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    logs.push(`[LOG] ${new Date().toISOString()}: ${args.join(' ')}`);
    if (logs.length > logLimit) logs.shift();
    originalLog(...args);
  };
  console.error = (...args) => {
    logs.push(`[ERROR] ${new Date().toISOString()}: ${args.join(' ')}`);
    if (logs.length > logLimit) logs.shift();
    originalError(...args);
  };
  console.warn = (...args) => {
    logs.push(`[WARN] ${new Date().toISOString()}: ${args.join(' ')}`);
    if (logs.length > logLimit) logs.shift();
    originalWarn(...args);
  };

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  let db: any;
  try {
    console.log('Initializing database connection...');
    let dbPath = './data.sqlite';
    try {
      fs.appendFileSync(dbPath, '');
      console.log('Using database at:', path.resolve(dbPath));
    } catch (e) {
      console.warn('Database path NOT writable, falling back to /tmp/data.sqlite');
      dbPath = '/tmp/data.sqlite';
    }

    db = knex({
      client: 'better-sqlite3',
      connection: {
        filename: dbPath
      },
      useNullAsDefault: true,
      pool: {
        min: 1,
        max: 1,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000
      }
    });

    // Test connection
    await db.raw('SELECT 1');
    await db.raw('PRAGMA journal_mode = WAL;');
    await db.raw('PRAGMA foreign_keys = ON;');
    console.log('Database connection successful (WAL mode and Foreign Keys enabled).');
    console.log('Database path:', path.join(process.cwd(), 'data.sqlite'));

    console.log('Checking tables...');
    const tables = [
      {
        name: 'inventory',
        create: (table: any) => {
          table.increments('id').primary();
          table.string('name').notNullable();
          table.integer('quantity').defaultTo(0);
          table.decimal('price', 10, 2).defaultTo(0);
          table.timestamps(true, true);
        }
      },
      {
        name: 'customers',
        create: (table: any) => {
          table.increments('id').primary();
          table.string('name').notNullable();
          table.string('tax_id');
          table.string('address');
          table.string('phone');
          table.timestamps(true, true);
        }
      },
      {
        name: 'rentals',
        create: (table: any) => {
          table.increments('id').primary();
          table.integer('customer_id').unsigned().references('customers.id').notNullable();
          table.date('delivery_date').notNullable();
          table.date('return_date').notNullable();
          table.string('status').defaultTo('ACTIVE');
          table.timestamps(true, true);
        }
      },
      {
        name: 'rental_items',
        create: (table: any) => {
          table.increments('id');
          table.integer('rental_id').unsigned().references('rentals.id').onDelete('CASCADE');
          table.integer('inventory_id').unsigned().references('inventory.id');
          table.integer('quantity').notNullable();
        }
      }
    ];

    for (const { name, create } of tables) {
      if (!(await db.schema.hasTable(name))) {
        console.log(`Creating table ${name}...`);
        await db.schema.createTable(name, create);
      } else {
        const columns = await db(name).columnInfo();
        console.log(`Table ${name} exists with columns:`, Object.keys(columns).join(', '));
        
        if (name === 'inventory') {
          const hasPrice = await db.schema.hasColumn('inventory', 'price');
          if (!hasPrice) {
            console.log('Adding price column to inventory...');
            await db.schema.table('inventory', table => {
              table.decimal('price', 10, 2).defaultTo(0);
            });
          }
        }
      }
    }
    // Schema verification complete.
  } catch (error) {
    console.error('DATABASE CRITICAL ERROR:', error);
  }

  // Logging middleware (MUST BE ONE OF THE FIRST)
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const logMsg = `${timestamp} - RECV: ${req.method} ${req.path}`;
    logs.push(logMsg);
    if (logs.length > logLimit) logs.shift();
    originalLog(logMsg);
    next();
  });

  app.use(express.json());

  app.get('/api/debug/logs', (req, res) => {
    res.json(logs);
  });

  // Request logging for debugging
  app.use((req, res, next) => {
    if (req.path !== '/api/health') {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      if (['POST', 'PUT'].includes(req.method)) {
        console.log('Body:', JSON.stringify(req.body));
      }
    }
    next();
  });

  app.get('/api/health', async (req, res) => {
    let db_writable = false;
    if (db) {
      try {
        await db.raw('SELECT 1');
        db_writable = true;
      } catch (e) {
        console.error('Database health check failed:', e);
      }
    }
    res.json({ 
      status: db && db_writable ? 'ok' : 'error', 
      database_ready: !!db,
      database_writable: db_writable,
      db_initialized: true,
      time: new Date().toISOString(),
      node_env: process.env.NODE_ENV
    });
  });

  // Inventory
  app.get('/api/inventory', async (req, res) => {
    const items = await db('inventory').select('*');
    const enrichedItems = [];
    for (const item of items) {
      const rented = await db('rental_items')
        .join('rentals', 'rental_items.rental_id', '=', 'rentals.id')
        .where('rental_items.inventory_id', item.id)
        .where('rentals.status', 'ACTIVE')
        .sum('rental_items.quantity as total')
        .first();
      enrichedItems.push({
        ...item,
        available: item.quantity - (rented?.total || 0),
        rented: rented?.total || 0
      });
    }
    res.json(enrichedItems);
  });

  app.post('/api/inventory', async (req, res) => {
    try {
      console.log('Inserting into inventory:', req.body);
      const [id] = await db('inventory').insert(req.body);
      const item = await db('inventory').where({ id }).first();
      io.emit('inventory_updated');
      res.json(item);
    } catch (error) {
      console.error('Error in POST /api/inventory:', error);
      res.status(500).json({ error: 'Failed to create inventory item', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/inventory/:id', async (req, res) => {
    try {
      await db('inventory').where({ id: req.params.id }).update(req.body);
      io.emit('inventory_updated');
      res.json({ success: true });
    } catch (error) {
      console.error('Error in PUT /api/inventory:', error);
      res.status(500).json({ error: 'Failed to update inventory item' });
    }
  });

  app.delete('/api/inventory/:id', async (req, res) => {
    try {
      await db('inventory').where({ id: req.params.id }).delete();
      io.emit('inventory_updated');
      res.json({ success: true });
    } catch (error) {
      console.error('Error in DELETE /api/inventory:', error);
      res.status(500).json({ error: 'Failed to delete inventory item' });
    }
  });

  // Customers
  app.get('/api/customers', async (req, res) => {
    const customers = await db('customers').select('*');
    res.json(customers);
  });

  app.post('/api/customers', async (req, res) => {
    try {
      console.log('Inserting into customers:', req.body);
      const [id] = await db('customers').insert(req.body);
      const customer = await db('customers').where({ id }).first();
      io.emit('customers_updated');
      res.json(customer);
    } catch (error) {
      console.error('Error in POST /api/customers:', error);
      res.status(500).json({ error: 'Failed to create customer', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      await db('customers').where({ id: req.params.id }).update(req.body);
      io.emit('customers_updated');
      res.json({ success: true });
    } catch (error) {
      console.error('Error in PUT /api/customers:', error);
      res.status(500).json({ error: 'Failed to update customer' });
    }
  });

  // Rentals
  app.get('/api/rentals', async (req, res) => {
    const rentals = await db('rentals')
      .join('customers', 'rentals.customer_id', '=', 'customers.id')
      .select(
        'rentals.*', 
        'customers.name as customer_name', 
        'customers.phone as customer_phone',
        'customers.address as customer_address',
        'customers.tax_id as customer_tax_id'
      );
    
    for (const rental of rentals) {
      rental.items = await db('rental_items')
        .join('inventory', 'rental_items.inventory_id', '=', 'inventory.id')
        .where('rental_id', rental.id)
        .select('rental_items.*', 'inventory.name as item_name', 'inventory.price as item_price');
    }
    res.json(rentals);
  });

  app.post('/api/rentals', async (req, res) => {
    const trx = await db.transaction();
    try {
      const { customer_id, delivery_date, return_date, items } = req.body;
      console.log('Creating rental transaction:', { customer_id, items_count: items?.length });
      
      const [rental_id] = await trx('rentals').insert({
        customer_id,
        delivery_date,
        return_date,
        status: 'ACTIVE'
      });

      for (const item of items) {
        await trx('rental_items').insert({
          rental_id,
          inventory_id: item.inventory_id,
          quantity: item.quantity
        });
      }

      await trx.commit();
      console.log('Rental transaction committed successfully, ID:', rental_id);

      io.emit('rentals_updated');
      io.emit('inventory_updated');
      res.json({ id: rental_id });
    } catch (error) {
      await trx.rollback();
      console.error('Error in POST /api/rentals (rolled back):', error);
      res.status(500).json({ error: 'Failed to create rental', details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post('/api/rentals/:id/return', async (req, res) => {
    await db('rentals').where({ id: req.params.id }).update({ status: 'RETURNED' });
    io.emit('rentals_updated');
    io.emit('inventory_updated');
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get('/api/stats', async (req, res) => {
    const totalInventory = await db('inventory').sum('quantity as total').first();
    
    const activeRentals = await db('rentals').where('status', 'ACTIVE');
    let rentedQuantity = 0;
    let lateRentalsCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const rental of activeRentals) {
      const items = await db('rental_items').where('rental_id', rental.id).sum('quantity as total').first();
      rentedQuantity += items?.total || 0;
      if (rental.return_date < today) {
        lateRentalsCount++;
      }
    }

    const totalCustomers = await db('customers').count('id as total').first();

    res.json({
      totalInventory: totalInventory?.total || 0,
      availableInventory: (totalInventory?.total || 0) - rentedQuantity,
      activeRentals: activeRentals.length,
      lateRentals: lateRentalsCount,
      totalCustomers: totalCustomers?.total || 0
    });
  });

  // Socket connection
  io.on('connection', (socket) => {
    console.log('Client connected');
  });

  // Log all errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('SERVER ERROR:', err);
    res.status(500).json({ 
      error: 'Erro interno no servidor', 
      details: err instanceof Error ? err.message : String(err) 
    });
  });

  // Vite Integration
  console.log('Initializing Vite/Static middleware...');
  const distPath = path.resolve(process.cwd(), 'dist');
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware initialized.');
  } else {
    console.log('Serving static files from:', distPath);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  console.log(`Attempting to listen on port ${PORT}...`);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
