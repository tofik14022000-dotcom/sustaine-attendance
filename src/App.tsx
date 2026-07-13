// @ts-ignore
import { useState, useEffect, useRef } from 'react'
// @ts-ignore
import * as faceapi from '@vladmandic/face-api'

// 🏢 KOORDINAT RESMI KANTOR & RADIUS DIKUNCI STRICT 20 METER
const KANTOR_LAT = -6.183546797680162
const KANTOR_LNG = 106.896546842617
const RADIUS_MAKSIMAL_METER = 20 

// 🧠 URL Otak AI dari CDN
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'

// 🔑 PIN Rahasia Admin & Kunci Cache Lokal
const PIN_ADMIN_RAHASIA = '011730'
const LS_FACES_KEY = 'sustaine_absen_faces_database'

interface LogAbsen {
  nama: string
  waktu: string
  tipe: string
  status: string
}

interface RegisteredEmployees {
  [name: string]: Float32Array;
}

export default function App() {
  const [tipeAbsen, setTipeAbsen] = useState<'Clock In' | 'Clock Out'>('Clock In')
  const [statusGPS, setStatusGPS] = useState('Checking location...')
  const [isDalamRadius, setIsDalamRadius] = useState(false)
  const [infoJarak, setInfoJarak] = useState('Calculating device distance...')
  
  // State AI Wajah & Akses Admin
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [statusUploadFoto, setStatusUploadFoto] = useState('Ready to upload corporate face metrics ⬆️')
  const [isScanning, setIsScanning] = useState(false)
  const [statusFaceID, setStatusFaceID] = useState('System initializing...')
  const [isAdminMode, setIsAdminMode] = useState(false)

  // Database Wajah Lokal Multi-Karyawan
  const [registeredEmployees, setRegisteredEmployees] = useState<RegisteredEmployees>({})
  
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  // Data list awal bawaan dashboard
  const [riwayat, setRiwayat] = useState<LogAbsen[]>([
    { nama: 'Tofik_Head Creative', waktu: '14/07/2026, 00:50:48', tipe: 'Clock In', status: 'On Time ✅' }
  ])

  // 1. RUMUS JARAK GPS
  const hitungJarakMeter = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3
    const phi1 = lat1 * Math.PI / 180, phi2 = lat2 * Math.PI / 180
    const deltaPhi = (lat2 - lat1) * Math.PI / 180, deltaLambda = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
  }

  // 2. SINKRONISASI CACHE BROWSER & LOAD MODEL AI
  useEffect(() => {
    try {
      const storedFaces = localStorage.getItem(LS_FACES_KEY)
      if (storedFaces) {
        const parsedFaces = JSON.parse(storedFaces)
        const typedFaces: RegisteredEmployees = {}
        for (const name in parsedFaces) { typedFaces[name] = new Float32Array(parsedFaces[name]) }
        setRegisteredEmployees(typedFaces)
      }
    } catch (err) { console.error(err) }

    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        setIsModelLoaded(true)
        setStatusFaceID('Face ID system is ready to use')
      } catch (err) { 
        setStatusFaceID('Failed to load biometric layers.') 
      }
    }
    loadModels()
  }, [])

  // 3. TRACK GPS REAL-TIME DENGAN VALIDASI RADIUS 20 METER
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition((position) => {
      const { latitude, longitude } = position.coords
      const jarak = hitungJarakMeter(latitude, longitude, KANTOR_LAT, KANTOR_LNG)
      setInfoJarak(`Device distance: ${Math.round(jarak)} meters from office area`)
      
      const dalamRadius = jarak <= RADIUS_MAKSIMAL_METER
      setIsDalamRadius(dalamRadius)
      setStatusGPS(dalamRadius ? 'Within Office Radius' : 'Outside Office Radius')
    }, () => {
      // 🛠️ Variabel error yang mubazir sudah dihapus agar disetujui TypeScript production
      setStatusGPS('GPS Access Denied! ❌')
      setInfoJarak('Please enable location services.')
    }, { enableHighAccuracy: true })
    
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  const tanganiKlikAdmin = () => {
    if (isAdminMode) return setIsAdminMode(false)
    const inputPin = prompt('Enter Admin Credentials PIN:')
    if (inputPin === PIN_ADMIN_RAHASIA) { setIsAdminMode(true) } else if (inputPin !== null) { alert('Access Denied! ❌') }
  }

  // 4. REGISTRASI FOTO KARYAWAN BARU
  const tanganiUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isModelLoaded) return alert('Biometric core is loading...')
    const file = e.target.files?.[0]
    if (!file) return

    const cleanName = file.name.split('.').slice(0, -1).join('.').replace(/_/g, ' ') || file.name
    setStatusUploadFoto(`Analyzing visual profile: "${file.name}"...`)
    
    try {
      const img = await faceapi.bufferToImage(file)
      const deteksi = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor()

      if (!deteksi) {
        setStatusUploadFoto('Face landmarks not resolved. Retry with a clearer image! ❌')
      } else {
        setRegisteredEmployees(prev => {
          const newDb = { ...prev, [cleanName]: deteksi.descriptor }
          const dbToStore: { [key: string]: number[] } = {}
          for (const name in newDb) { dbToStore[name] = Array.from(newDb[name]) }
          localStorage.setItem(LS_FACES_KEY, JSON.stringify(dbToStore))
          return newDb
        })
        setStatusUploadFoto(`Employee "${cleanName}" securely enrolled! 🔒✅`)
      }
    } catch (err) { setStatusUploadFoto('Encryption error on image processing. ❌') }
  }

  // 5. PROSES LIVE SCANNING & IDENTIFIKASI WAJAH MULTI-ORANG
  const mulaiScanFaceID = async () => {
    if (!isDalamRadius) return alert('Access Denied: You must be within the 20-meter office radius to scan!')
    if (Object.keys(registeredEmployees).length === 0) return alert('Enrollment required: No employee records found!')

    setIsScanning(true)
    setStatusFaceID('Activating optical matrix...')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      setStatusFaceID('Scanning biological structures... Hold still.')

      setTimeout(async () => {
        if (!videoRef.current) return

        const deteksiLive = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor()

        if (!deteksiLive) {
          setStatusFaceID('Scan failed: Face architecture lost. ❌')
          matikanKamera()
          setTimeout(() => setIsScanning(false), 2000)
          return
        }

        let identifiedName = ''
        let minDistance = 1.0

        for (const name in registeredEmployees) {
          const distance = faceapi.euclideanDistance(registeredEmployees[name], deteksiLive.descriptor)
          if (distance < minDistance) { minDistance = distance; identifiedName = name; }
        }
        
        if (identifiedName && minDistance < 0.6) {
          const sekarang = new Date()
          const statusHari = sekarang.getHours() > 10 || (sekarang.getHours() === 10 && sekarang.getMinutes() > 0) ? 'Late ⚠️' : 'On Time ✅'
          const statusFinal = tipeAbsen === 'Clock Out' ? 'Clocked Out 🚗' : statusHari

          setStatusFaceID(`Welcome, ${identifiedName}! 🎉`)
          
          setRiwayat(prev => [{
            nama: identifiedName,
            waktu: sekarang.toLocaleString('en-US', { hour12: false }),
            tipe: tipeAbsen,
            status: statusFinal
          }, ...prev])
        } else {
          setStatusFaceID('Access Denied: Unrecognized biometric identity! ❌')
        }

        matikanKamera()
        setTimeout(() => {
          setIsScanning(false)
          setStatusFaceID('Face ID system is ready to use')
        }, 3000)

      }, 2500)

    } catch (err) {
      setStatusFaceID('Failed to initialize local video input.')
      setIsScanning(false)
    }
  }

  const matikanKamera = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()) }

  return (
    <div style={styles.container}>
      
      {/* LOGO BRAND IMAGE */}
      <div style={styles.logoContainer}>
        <img 
          src="/logo.png" 
          alt="Sustaine" 
          style={styles.logoImage}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
            const backup = document.getElementById('backup-logo');
            if (backup) backup.style.display = 'block';
          }}
        />
        <div id="backup-logo" style={styles.backupLogoText}>sustaine</div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
        <h1 style={styles.judulAplikasi}>Smart Attendance</h1>
        <p style={styles.subJudulAplikasi}>GPS & Face ID Digital Attendance</p>
      </div>

      {/* CARD LAYAR UTAMA (#0957c3) */}
      <div style={styles.mainCard}>
        
        {!isScanning && (
          <>
            {/* PANEL REGISTRASI ADMIN */}
            {isAdminMode && (
              <div style={styles.uploadSection}>
                <label style={styles.labelAdmin}>⚠️ SECURE ENROLLMENT PORTAL</label>
                <input type="file" accept="image/*" onChange={tanganiUploadFoto} style={styles.fileInput} />
                <p style={{ margin: '4px 0', fontSize: '11px', color: '#fff' }}>{statusUploadFoto}</p>
                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '6px' }}>
                  <span style={styles.infoLabelCapsule}>Enrolled Workforce:</span>
                  <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#fff', opacity: 0.9 }}>
                    {Object.keys(registeredEmployees).length === 0 ? 'None' : Object.keys(registeredEmployees).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* CAPSULE TOGGLE SHIFT */}
            <div style={styles.toggleContainer}>
              <button 
                onClick={() => setTipeAbsen('Clock In')} 
                style={{
                  ...styles.toggleButton, 
                  backgroundColor: tipeAbsen === 'Clock In' ? '#0957c3' : 'transparent',
                  color: tipeAbsen === 'Clock In' ? '#ffffff' : '#0957c3'
                }}
              >
                Clock In
              </button>
              <button 
                onClick={() => setTipeAbsen('Clock Out')} 
                style={{
                  ...styles.toggleButton, 
                  backgroundColor: tipeAbsen === 'Clock Out' ? '#0957c3' : 'transparent',
                  color: tipeAbsen === 'Clock Out' ? '#ffffff' : '#0957c3'
                }}
              >
                Clock Out
              </button>
            </div>
          </>
        )}

        {/* AREA SCANNER LIVE CAMERA */}
        {isScanning && (
          <div style={styles.cameraContainer}>
            <video ref={videoRef} autoPlay playsInline muted style={styles.videoFeed} />
            <div style={styles.laserLine}></div>
          </div>
        )}

        {/* KOTAK DALAM GELAP (INNER VALIDATION BOX) */}
        <div style={styles.innerValidationBox}>
          
          {/* SECTION GEOFENCING */}
          <div style={styles.infoLabelCapsule}>GEOFENCING AREA VALIDATION</div>
          <p style={styles.statusBesar}>{statusGPS}</p>
          
          <div style={{
            ...styles.iconContainerCheck,
            backgroundColor: isDalamRadius ? '#ffffff' : 'rgba(255,255,255,0.2)'
          }}>
            <span style={{ color: isDalamRadius ? '#0957c3' : '#ff4d4d', fontSize: '18px', fontWeight: 'bold' }}>
              {isDalamRadius ? '✓' : '✕'}
            </span>
          </div>
          
          <p style={styles.statusKecilText}>{infoJarak}</p>

          <div style={{ margin: '16px 0 10px 0', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
            {/* SECTION AI FACE */}
            <div style={styles.infoLabelCapsule}>AI FACE AUTHENTICATION</div>
            <p style={{ ...styles.statusKecilText, marginTop: '6px' }}>{statusFaceID}</p>
          </div>

        </div>

        {/* TOMBOL PROSES TERKUNCI RADIUS 20 METER */}
        {!isScanning ? (
          <button 
            disabled={!isDalamRadius || Object.keys(registeredEmployees).length === 0 || !isModelLoaded}
            onClick={mulaiScanFaceID}
            style={{
              ...styles.actionButtonMain,
              backgroundColor: isDalamRadius ? '#ffffff' : 'rgba(255, 255, 255, 0.25)',
              color: isDalamRadius ? '#0957c3' : 'rgba(255, 255, 255, 0.5)',
              cursor: isDalamRadius ? 'pointer' : 'not-allowed',
              boxShadow: isDalamRadius ? '0 8px 20px rgba(0,0,0,0.15)' : 'none'
            }}
          >
            {!isModelLoaded 
              ? 'Loading System...' 
              : (!isDalamRadius 
                ? 'Outside Office Radius' 
                : (Object.keys(registeredEmployees).length > 0 ? `Verify Face (${tipeAbsen})` : 'Enrollment Required')
              )
            }
          </button>
        ) : (
          <button 
            onClick={() => { matikanKamera(); setIsScanning(false); }} 
            style={{ ...styles.actionButtonMain, backgroundColor: '#ff4d4d', color: '#fff' }}
          >
            Cancel Scanning
          </button>
        )}
      </div>

      {/* TODAY'S ATTENDANCE LOGS CARD */}
      <div style={styles.logCard}>
        <h2 style={styles.logCardTitle}>Today's Attendance Logs</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.tableElement}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableTh}>Name</th>
                <th style={styles.tableTh}>Log Time</th>
                <th style={styles.tableTh}>Category</th>
                <th style={styles.thRight}>Status</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((log, idx) => (
                <tr key={idx} style={styles.tableDataRow}>
                  <td style={{ ...styles.tableTd, fontWeight: '600' }}>{log.nama}</td>
                  <td style={styles.tableTd}>{log.waktu}</td>
                  <td style={styles.tableTd}>{log.tipe}</td>
                  <td style={styles.tdRight}>{log.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* RAHASIA ADMIN SWITCH BAWAH KANAN */}
      <div style={styles.footerAdminContainer}>
        {!isScanning && (
          <button onClick={tanganiKlikAdmin} style={styles.floatingGearAdmin}>
            ⚙️
          </button>
        )}
      </div>

    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'flex-start', minHeight: '100vh', backgroundColor: '#121214', color: '#ffffff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', padding: '40px 16px 80px 16px', gap: '16px', boxSizing: 'border-box' as const, width: '100vw' },
  logoContainer: { marginBottom: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  logoImage: { height: '65px', objectFit: 'contain' as const },
  backupLogoText: { display: 'none', backgroundColor: '#0957c3', color: '#ffffff', padding: '6px 24px', borderRadius: '10px', fontWeight: 'bold', fontSize: '20px', letterSpacing: '-0.5px' },
  judulAplikasi: { fontSize: '28px', fontWeight: '700', color: '#ffffff', margin: 0, letterSpacing: '-0.5px' },
  subJudulAplikasi: { fontSize: '13px', color: '#8e8e93', margin: '4px 0 12px 0' },
  mainCard: { backgroundColor: '#0957c3', padding: '24px', borderRadius: '28px', width: '100%', maxWidth: '380px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', boxSizing: 'border-box' as const },
  toggleContainer: { display: 'flex', backgroundColor: '#ffffff', padding: '5px', borderRadius: '16px', marginBottom: '16px' },
  toggleButton: { flex: 1, border: 'none', padding: '12px 6px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s ease' },
  innerValidationBox: { backgroundColor: '#06469c', borderRadius: '20px', padding: '20px 14px', margin: '16px 0', textAlign: 'center' as const, border: '1px solid rgba(255, 255, 255, 0.05)' },
  infoLabelCapsule: { backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '5px 14px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', display: 'inline-block', color: '#ffffff', marginBottom: '6px' },
  statusBesar: { fontSize: '16px', fontWeight: '600', color: '#ffffff', margin: '4px 0 12px 0' },
  statusKecilText: { fontSize: '12px', color: '#ffffff', opacity: 0.85, margin: '4px 0 0 0', lineHeight: '1.4' },
  iconContainerCheck: { width: '32px', height: '32px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px auto' },
  actionButtonMain: { width: '100%', border: 'none', borderRadius: '16px', padding: '16px', fontSize: '17px', fontWeight: '700', boxSizing: 'border-box' as const, transition: 'all 0.2s ease' },
  cameraContainer: { position: 'relative' as const, width: '100%', height: '200px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#000', border: '2px solid #ffffff', marginBottom: '20px' },
  videoFeed: { width: '100%', height: '100%', objectFit: 'cover' as const, transform: 'scaleX(-1)' },
  laserLine: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '4px', backgroundColor: '#22c55e', boxShadow: '0 0 12px #22c55e', animation: 'scan 2s linear infinite' },
  uploadSection: { backgroundColor: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '16px', border: '1px dashed #ffffff', marginBottom: '20px', boxSizing: 'border-box' as const },
  labelAdmin: { display: 'block', fontSize: '10px', fontWeight: '700', color: '#ffffff', marginBottom: '4px' },
  fileInput: { marginTop: '6px', marginBottom: '6px', display: 'block', width: '100%', fontSize: '11px', color: '#ffffff' },
  faceStatusBox: { marginTop: '8px' },
  logCard: { backgroundColor: '#0957c3', padding: '24px 20px', borderRadius: '24px', width: '100%', maxWidth: '380px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', boxSizing: 'border-box' as const },
  logCardTitle: { fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '16px', textAlign: 'center' as const },
  tableElement: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px' },
  tableHeaderRow: { borderBottom: '1px solid rgba(255, 255, 255, 0.25)' },
  tableTh: { padding: '8px 4px', color: '#ffffff', opacity: 0.8, fontWeight: '500', textAlign: 'left' as const },
  thRight: { padding: '8px 4px', color: '#ffffff', opacity: 0.8, fontWeight: '500', textAlign: 'right' as const },
  tableDataRow: { borderBottom: '1px solid rgba(255, 255, 255, 0.1)' },
  tableTd: { padding: '12px 4px', color: '#ffffff', textAlign: 'left' as const },
  tdRight: { padding: '12px 4px', color: '#ffffff', textAlign: 'right' as const },
  footerAdminContainer: { width: '100%', maxWidth: '380px', display: 'flex', justifyContent: 'flex-end', marginTop: '4px' },
  floatingGearAdmin: { border: 'none', backgroundColor: '#ffffff', color: '#1c1c1e', fontSize: '16px', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }
}