import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || '')

export default async function handler(req: any, res: any) {
  const LOGS_KEY = 'sustaine_absen_attendance_logs'

  if (req.method === 'GET') {
    try {
      const data = await redis.get(LOGS_KEY)
      return res.status(200).json(data ? JSON.parse(data) : [])
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch global logs' })
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body
      if (typeof body === 'string') body = JSON.parse(body)
      
      // 🧹 FITUR RESET: Menghapus seluruh riwayat log di cloud
      if (body.action === 'CLEAR_ALL') {
        await redis.set(LOGS_KEY, JSON.stringify([]))
        return res.status(200).json({ success: true })
      }

      const { newLog } = body
      if (!newLog) return res.status(400).json({ error: 'Missing log data' })

      const currentData = await redis.get(LOGS_KEY)
      const currentLogs = currentData ? JSON.parse(currentData) : []
      
      const updatedLogs = [newLog, ...currentLogs]
      
      await redis.set(LOGS_KEY, JSON.stringify(updatedLogs))
      return res.status(200).json({ success: true })
    } catch (err) {
      return res.status(500).json({ error: 'Failed to save global log' })
    }
  }

  return res.status(405).send('Method Not Allowed')
}