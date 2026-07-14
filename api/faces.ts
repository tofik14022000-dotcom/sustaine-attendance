import Redis from 'ioredis'

// 🔌 Menghubungkan backend ke REDIS_URL Vercel
const redis = new Redis(process.env.REDIS_URL || '')

export default async function handler(req: any, res: any) {
  const DB_KEY = 'sustaine_absen_faces_database'

  // ☁️ AMBIL DATA: Seluruh HP Karyawan mengambil database wajah terpusat dari Redis
  if (req.method === 'GET') {
    try {
      const data = await redis.get(DB_KEY)
      return res.status(200).json(data ? JSON.parse(data) : {})
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch from Redis cloud' })
    }
  }

  // ☁️ SIMPAN DATA: Ketika Admin upload foto master baru, datanya disimpan ke Redis
  if (req.method === 'POST') {
    try {
      const { name, descriptor } = req.body
      
      const currentData = await redis.get(DB_KEY)
      const currentDb = currentData ? JSON.parse(currentData) : {}
      
      currentDb[name] = descriptor
      
      await redis.set(DB_KEY, JSON.stringify(currentDb))
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save to Redis cloud' })
    }
  }

  return res.status(405).send('Method Not Allowed')
}