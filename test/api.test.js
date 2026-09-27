import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/threatshare_test'
process.env.JWT_SECRET = 'test-secret'

const { app } = await import('../server/index.js')
const { Alert, Threat, User } = await import('../server/models.js')
let adminToken
let viewerToken

before(async () => {
    await mongoose.connect(process.env.MONGODB_URI)
})

beforeEach(async () => {
    await Promise.all([Threat.deleteMany({}), Alert.deleteMany({}), User.deleteMany({})])
    const passwordHash = await bcrypt.hash('test-password', 4)
    await User.create([
        { name: 'Test Admin', email: 'admin@test.local', passwordHash, role: 'Administrator', initials: 'TA' },
        { name: 'Test Viewer', email: 'viewer@test.local', passwordHash, role: 'Viewer', initials: 'TV' },
    ])
    adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'test-password' })).body.token
    viewerToken = (await request(app).post('/api/auth/login').send({ email: 'viewer@test.local', password: 'test-password' })).body.token
})

after(async () => {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
})

test('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/dashboard')
    assert.equal(response.status, 401)
})

test('logs in and returns the stored role', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'admin@test.local', password: 'test-password' })
    assert.equal(response.status, 200)
    assert.equal(response.body.user.role, 'Administrator')
    assert.ok(response.body.token)
})

test('creates a critical threat and escalation alert', async () => {
    const response = await request(app).post('/api/threats').set('Authorization', `Bearer ${adminToken}`).send({ indicator: '203.0.113.50', type: 'IP Address', category: 'Ransomware', confidence: 95 })
    assert.equal(response.status, 201)
    assert.equal(response.body.detection, 'new')
    assert.equal(response.body.threat.severity, 'Critical')
    assert.equal(await Alert.countDocuments({ status: 'Open' }), 1)
})

test('correlates indicators and detects re-sightings', async () => {
    const first = await request(app).post('/api/threats').set('Authorization', `Bearer ${adminToken}`).send({ indicator: 'alpha.example', type: 'Domain', category: 'Phishing', confidence: 60 })
    const correlated = await request(app).post('/api/threats').set('Authorization', `Bearer ${adminToken}`).send({ indicator: 'beta.example', type: 'Domain', category: 'Phishing', confidence: 60 })
    const resighted = await request(app).post('/api/threats').set('Authorization', `Bearer ${adminToken}`).send({ indicator: ' ALPHA.EXAMPLE ', type: 'Domain', category: 'Phishing', confidence: 70 })
    assert.equal(first.body.detection, 'new')
    assert.equal(correlated.body.detection, 'correlated')
    assert.equal(correlated.body.relatedCount, 1)
    assert.equal(resighted.body.detection, 're-sighting')
    assert.equal(resighted.body.threat.sightings, 2)
})

test('viewer cannot submit threats', async () => {
    const response = await request(app).post('/api/threats').set('Authorization', `Bearer ${viewerToken}`).send({ indicator: 'viewer.example', type: 'Domain' })
    assert.equal(response.status, 403)
})