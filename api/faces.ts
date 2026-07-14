import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || '')

export default async function handler(req: any, res: any) {
  const DB_KEY = 'sustaine_absen_faces_database'

  if (req.method === 'GET') {
    try {
      const data = await redis.get(DB_KEY)
      return res.status(200).json(data ? JSON.parse(data) : {})
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch from Redis cloud' })
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body
      if (typeof body === 'string') body = JSON.parse(body)
      
      // 🧹 FITUR RESET: Menghapus seluruh master wajah di cloud
      if (body.action === 'CLEAR_ALL') {
        await redis.set(DB_KEY, JSON.stringify({}))
        return res.status(200).json({ success: true })
      }

      const { name, descriptor } = body
      if (!name || !descriptor) return res.status(400).json({ error: 'Missing name or descriptor' })

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