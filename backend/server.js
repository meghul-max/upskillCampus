const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const dataDir = path.join(__dirname, 'data');
const productsFile = path.join(dataDir, 'products.json');
const usersFile = path.join(dataDir, 'users.json');
const ordersFile = path.join(dataDir, 'orders.json');

// helper read/write
function readJSON(filePath){
  return new Promise((res, rej) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if(err) return rej(err);
      try { res(JSON.parse(data || '[]')) } catch(e){ rej(e) }
    });
  });
}
function writeJSON(filePath, obj){
  return new Promise((res, rej) => {
    fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8', err => {
      if(err) return rej(err);
      res();
    });
  });
}

/** Products - read only **/
app.get('/api/products', async (req, res) => {
  try {
    const products = await readJSON(productsFile);
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: 'Unable to read products' });
  }
});

/** Register **/
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if(!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });

    const users = await readJSON(usersFile);
    if(users.find(u => u.email.toLowerCase() === email.toLowerCase()))
      return res.status(400).json({ message: 'Email already registered' });

    const newUser = { id: users.length + 1, name, email: email.toLowerCase(), password, phone: phone || '' };
    users.push(newUser);
    await writeJSON(usersFile, users);
    // Do not send password back in production
    res.json({ message: 'Registration successful', user: { id: newUser.id, name: newUser.name, email: newUser.email } });
  } catch(e) {
    res.status(500).json({ error: 'Unable to register' });
  }
});

/** Login **/
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = await readJSON(usersFile);
    const user = users.find(u => u.email.toLowerCase() === (email||'').toLowerCase() && u.password === password);
    if(!user) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ message: 'Login successful', user: { id: user.id, name: user.name, email: user.email, phone: user.phone } });
  } catch(e) {
    res.status(500).json({ error: 'Unable to login' });
  }
});

/** Place Order **/
app.post('/api/order', async (req, res) => {
  try {
    const order = req.body; // { userEmail, name, phone, address, city, items: [{id,name,price,quantity}], total }
    if(!order || !order.items || !Array.isArray(order.items) || order.items.length === 0)
      return res.status(400).json({ message: 'Invalid order' });

    const orders = await readJSON(ordersFile);
    const newOrder = {
      id: 'ORD' + (Date.now()),
      ...order,
      date: new Date().toISOString()
    };
    orders.unshift(newOrder);
    await writeJSON(ordersFile, orders);
    res.json({ message: 'Order placed', orderId: newOrder.id });
  } catch(e) {
    res.status(500).json({ error: 'Unable to place order' });
  }
});

/** Get orders (optional query ?user=email ) **/
app.get('/api/orders', async (req, res) => {
  try {
    const user = req.query.user;
    const orders = await readJSON(ordersFile);
    if(user){
      return res.json(orders.filter(o => (o.userEmail||'').toLowerCase() === user.toLowerCase()));
    }
    res.json(orders);
  } catch(e) {
    res.status(500).json({ error: 'Unable to read orders' });
  }
});

/** Serve static images if you put images in backend/data/images (optional) **/
app.use('/static', express.static(path.join(__dirname, 'data', 'images')));

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
