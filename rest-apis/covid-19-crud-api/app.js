const express = require('express')
const path = require('path')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19India.db')

let db = null

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Running on http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB ERROR ${e.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

//API 1 GET STATES
app.get('/states/', async (request, response) => {
  const getStatesQuery = `SELECT 
    state_id AS stateId,
    state_name AS stateName,
    population
    FROM state 
    ORDER BY state_id; `
  const statesArray = await db.all(getStatesQuery)
  response.send(statesArray)
})

//API 2 GET STATES BASED ON STATE ID
app.get('/states/:stateId/', async (request, response) => {
  const {stateId} = request.params
  const getStatesIdQuery = `
  SELECT 
  state_id AS stateId,
  state_name AS stateName,
  population
  FROM state 
  WHERE state_id=${stateId};`
  const state = await db.get(getStatesIdQuery)
  response.send(state)
})

//API 3 POST DISTRICTS
app.post('/districts/', async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDetailsQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths)
  VALUES (?,?,?,?,?,?);`

  await db.run(
    postDetailsQuery,
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  )
  response.send('District Successfully Added')
})

//API 4 GET districts on id---chanages needed!!!
app.get('/districts/:districtId/', async (request, response) => {
  const {districtId} = request.params
  const getdistrictIdQuery = `
   SELECT 
    district_id AS districtId,
    district_name AS districtName,
    state_id AS stateId,
    cases,
    cured,
    active,
    deaths
    FROM district WHERE district_id=?;`
  const district = await db.get(getdistrictIdQuery, districtId)
  response.send(district)
})

//API 5 DELETE district
app.delete('/districts/:districtId/', async (request, response) => {
  const {districtId} = request.params
  const deletedistrictQuery = `
  DELETE FROM district WHERE district_id=?`
  await db.run(deletedistrictQuery, districtId)
  response.send('District Removed')
})

//API 6 PUT district
app.put('/districts/:districtId/', async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const updateDistrictQuery = `
  UPDATE district 
  SET 
  district_name=?,
  state_id=?,
  cases=?,
  cured=?,
  active=?,
  deaths=?
  WHERE 
  district_id=?;`
  await db.run(
    updateDistrictQuery,
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  )
  response.send('District Details Updated')
})

//API 7 GET statistics based on stateId---chanages needed!!!
app.get('/states/:stateId/stats/', async (request, response) => {
  const {stateId} = request.params
  const getStateStatsQuery = `
      SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
      FROM 
        district
      WHERE state_id=?;`
  const stateStats = await db.get(getStateStatsQuery, stateId)
  response.send(stateStats)
})

//API 8 GET state name based on dist _id
app.get('/districts/:districtId/details/', async (request, response) => {
  const {districtId} = request.params
  const getStateNameQuery = `
      SELECT 
        state_name AS stateName
      FROM state 
      JOIN district ON state.state_id=district.state_id
      WHERE district.district_id=?;`

  const finalStateName = await db.get(getStateNameQuery, districtId)
  response.send({stateName: finalStateName.stateName})
})

module.exports = app
