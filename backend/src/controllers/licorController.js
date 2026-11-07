import * as licorService from '../service/licorService.js';

export async function getLicores(req, res) {
  try {
    const licores = await licorService.getAllLicores();
    res.json(licores);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function postLicor(req, res) {
  try {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const newLicor = {
      name: req.body.name,
      price: parseFloat(req.body.price),
      stock: parseInt(req.body.stock),
      category: req.body.category,
      image: imageUrl
    };
    const data = await licorService.createLicor(newLicor);
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}