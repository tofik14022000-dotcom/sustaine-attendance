import Redis from 'ioredis'

// 🔌 Menghubungkan backend ke REDIS_URL Vercel lo
const redis = new Redis(process.env.REDIS_URL || '')

export default async function handler(req: any, res: any) {
  const DB_KEY = 'sustaine_absen_faces_database'

  // ☁️ AMBIL DATA: Mengambil database wajah terpusat dari Redis
  if (req.method === 'GET') {
    try {
      const data = await redis.get(DB_KEY)
      return res.status(200).json(data ? JSON.parse(data) : {})
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch from Redis cloud' })
    }
  }

  // ☁️ SIMPAN DATA: Menyimpan data matriks wajah baru ke Redis Cloud
  if (req.method === 'POST') {
    try {
      // Proteksi berlapis jika body dikirim dalam bentuk string mentah
      let body = req.body
      if (typeof body === 'string') {
        body = JSON.parse(body)
      }
      
      const { name, descriptor } = body
      
      if (!name || !descriptor) {
        return res.status(400).json({ error: 'Missing name or descriptor' })
      }

      // Ambil data yang sudah ada di awan
      const currentData = await redis.get(DB_KEY)
      const currentDb = currentData ? JSON.parse(currentData) : {}
      
      // Masukkan koordinat wajah karyawan baru
      currentDb[name] = descriptor
      
      // Kunci masuk ke Redis Cloud
      await redis.set(DB_KEY, JSON.stringify(currentDb))
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save to Redis cloud' })
    }
  }

  return res.status(405).send('Method Not Allowed')
}