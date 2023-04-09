import { Router } from 'express';
import { existsSync, mkdir } from 'fs';
import { dirname } from 'path';
const router = Router();

router.get('/', (req, res) => {
  res.render('index');
  // Check if downloads folder exists
  if (!existsSync('downloads'))
    mkdir('downloads', (err) => {
      if (err) {
        return console.error(err);
      }
    });
});

export default router;
