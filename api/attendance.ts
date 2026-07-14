import Redis from 'ioredis'

// 🔌 Menghubungkan ke REDIS_URL yang sama
const redis = new Redis(process.env.REDIS_URL || '')

export default async function handler(req: any, res: any) {
  const LOGS_KEY = 'sustaine_absen_attendance_logs'

  // ☁️ AMBIL RIWAYAT GLOBAL: Semua perangkat membaca log yang sama dari Cloud
  if (req.method === 'GET') {
    try {
      const data = await redis.get(LOGS_KEY)
      return res.status(200).json(data ? JSON.parse(data) : [])
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch global logs' })
    }
  }

  // ☁️ REKAM ABSEN BARU: Setiap ada yang scan sukses, datanya dilempar ke Cloud
  if (req.method === 'POST') {
    try {
      let body = req.body
      if (typeof body === 'string') {
        body = JSON.parse(body)
      }
      
      const { newLog } = body
      if (!newLog) return res.status(400).json({ error: 'Missing log data' })

      // Ambil tumpukan data absen lama di awan
      const currentData = await redis.get(LOGS_KEY)
      const currentLogs = currentData ? JSON.parse(currentData) : []
      
      // Selipkan absen terbaru di baris paling atas (Prepend)
      const updatedLogs = [newLog, ...currentLogs]
      
      // Kunci kembali ke Redis Cloud
      await redis.set(LOGS_KEY, JSON.stringify(updatedLogs))
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save global log' })
    }
  }

  return res.status(405).send('Method Not Allowed')
}