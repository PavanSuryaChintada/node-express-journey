const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'twitterClone.db')
const app = express()

app.use(express.json())

let db = null
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('server running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`db error:${e.message}`)
    process.exit(1)
  }
}
initializeDbAndServer()

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'mySecretCode', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//API 1 POST -register
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body

  if (!password) {
    return response.status(400).send('Password is required')
  }

  if (password.length < 6) {
    return response.status(400).send('Password is too short')
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const selectUserQuery = `SELECT * FROM user WHERE username = ?;`
  const dbUser = await db.get(selectUserQuery, [username])

  if (dbUser === undefined) {
    const createUserQuery = `
            INSERT INTO user (name, username, password, gender)
            VALUES (?, ?, ?, ?);`

    await db.run(createUserQuery, [name, username, hashedPassword, gender])
    return response.status(200).send('User created successfully')
  } else {
    return response.status(400).send('User already exists')
  }
})

//API 2 POST login
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  selectUserQuery = `
  SELECT * FROM user WHERE username=?;`
  const dbUser = await db.get(selectUserQuery, [username])
  if (dbUser === undefined) {
    response.status(400).send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'mySecretCode')
      response.send({jwtToken})
    } else {
      response.status(400).send('Invalid password')
    }
  }
})

//Authorization:Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkpvZUJpZGVuIiwiaWF0IjoxNzQ5MjgzNzc4fQ.Ju3Ss0skuA-ZOa4HarSpkA4C9ovX4DkPRDRsQ8dVuio

//API 3 get user/tweets/feed
app.get('/user/tweets/feed/', authenticateToken, async (request, response) => {
  const {username} = request
  const userQuery = `SELECT user_id FROM user WHERE username=?;`
  const user = await db.get(userQuery, [username])

  const tweetsQuery = `
        SELECT user.username, tweet.tweet, tweet.date_time AS dateTime
        FROM tweet 
        INNER JOIN follower ON tweet.user_id = follower.following_user_id
        INNER JOIN user ON user.user_id = tweet.user_id
        WHERE follower.follower_user_id = ?
        ORDER BY tweet.date_time DESC
        LIMIT 4;
    `

  const tweets = await db.all(tweetsQuery, [user.user_id])
  response.send(tweets)
})

//API 4 GET user/following
app.get('/user/following/', authenticateToken, async (request, response) => {
  const {username} = request
  const userQuery = `SELECT user_id FROM user WHERE username=?;`
  const user = await db.get(userQuery, [username])
  const followingQuery = `
        SELECT user.name
        FROM user
        INNER JOIN follower ON user.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ?;
    `

  const followingList = await db.all(followingQuery, [user.user_id])
  response.send(followingList)
})

//API 5 GET user/followers
app.get('/user/followers/', authenticateToken, async (request, response) => {
  const {username} = request
  const userQuery = `SELECT user_id FROM user WHERE username=?;`
  const user = await db.get(userQuery, [username])
  const followersQuery = `
        SELECT user.name
        FROM user
        INNER JOIN follower ON user.user_id = follower.follower_user_id
        WHERE follower.following_user_id = ?;
    `

  const followersList = await db.all(followersQuery, [user.user_id])
  response.send(followersList)
})

//API 6 yweet -tweet id
app.get('/tweets/:tweetId/', authenticateToken, async (request, response) => {
  const {username} = request
  const {tweetId} = request.params

  const userQuery = `SELECT user_id FROM user WHERE username=?;`
  const user = await db.get(userQuery, [username])

  if (!user) {
    return response.status(400).send('Invalid user')
  }

  const followingTweetQuery = `
        SELECT tweet.tweet, 
               tweet.date_time AS dateTime,
               (SELECT COUNT(*) FROM like WHERE like.tweet_id = tweet.tweet_id) AS likes,
               (SELECT COUNT(*) FROM reply WHERE reply.tweet_id = tweet.tweet_id) AS replies
        FROM tweet
        INNER JOIN follower ON tweet.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ? AND tweet.tweet_id = ?;
    `

  const tweetDetails = await db.get(followingTweetQuery, [
    user.user_id,
    tweetId,
  ])

  if (!tweetDetails) {
    return response.status(401).send('Invalid Request')
  }

  response.json(tweetDetails)
})

//API 7 GET tweets-tweetsId-likes
app.get(
  '/tweets/:tweetId/likes/',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const {tweetId} = request.params
    const userQuery = `SELECT user_id FROM user WHERE username=?;`
    const user = await db.get(userQuery, [username])

    const followingTweetQuery = `
        SELECT tweet.user_id 
        FROM tweet
        INNER JOIN follower ON tweet.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ? AND tweet.tweet_id = ?;
    `

    const followedTweet = await db.get(followingTweetQuery, [
      user.user_id,
      tweetId,
    ])

    if (!followedTweet) {
      return response.status(401).send('Invalid Request')
    }

    const likesQuery = `
        SELECT user.username 
        FROM like
        INNER JOIN user ON like.user_id = user.user_id
        WHERE like.tweet_id = ?;
    `

    const likedUsers = await db.all(likesQuery, [tweetId])
    const likes = likedUsers.map(user => user.username)

    response.send({likes})
  },
)

//API 8 GET replies
app.get(
  '/tweets/:tweetId/replies/',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const {tweetId} = request.params
    const userQuery = `SELECT user_id FROM user WHERE username=?;`
    const user = await db.get(userQuery, [username])

    const followingTweetQuery = `
        SELECT tweet.user_id 
        FROM tweet
        INNER JOIN follower ON tweet.user_id = follower.following_user_id
        WHERE follower.follower_user_id = ? AND tweet.tweet_id = ?;
    `

    const followedTweet = await db.get(followingTweetQuery, [
      user.user_id,
      tweetId,
    ])

    if (!followedTweet) {
      return response.status(401).send('Invalid Request')
    }

    const repliesQuery = `
        SELECT user.name, reply.reply 
        FROM reply
        INNER JOIN user ON reply.user_id = user.user_id
        WHERE reply.tweet_id = ?;
    `

    const replies = await db.all(repliesQuery, [tweetId])

    response.json({replies})
  },
)

//API 9 GET user-tweets
app.get('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request
  const userQuery = `SELECT user_id FROM user WHERE username=?;`
  const user = await db.get(userQuery, [username])

  const userTweetsQuery = `
        SELECT tweet.tweet, 
               tweet.date_time AS dateTime,
               (SELECT COUNT(*) FROM like WHERE like.tweet_id = tweet.tweet_id) AS likes,
               (SELECT COUNT(*) FROM reply WHERE reply.tweet_id = tweet.tweet_id) AS replies
        FROM tweet
        WHERE tweet.user_id = ?;
    `

  const userTweets = await db.all(userTweetsQuery, [user.user_id])

  response.send(userTweets)
})

//API 10 POST
app.post('/user/tweets/', authenticateToken, async (request, response) => {
  const {username} = request
  const {tweet} = request.body
  const userQuery = `SELECT user_id FROM user WHERE username=?;`
  const user = await db.get(userQuery, [username])

  const createTweetQuery = `
        INSERT INTO tweet (tweet, user_id, date_time)
        VALUES (?, ?, datetime('now'));
    `

  await db.run(createTweetQuery, [tweet, user.user_id])

  response.status(200).send('Created a Tweet')
})

//API 11 DELETE
app.delete(
  '/tweets/:tweetId/',
  authenticateToken,
  async (request, response) => {
    const {username} = request
    const {tweetId} = request.params
    const userQuery = `SELECT user_id FROM user WHERE username=?;`
    const user = await db.get(userQuery, [username])

    const tweetQuery = `SELECT user_id FROM tweet WHERE tweet_id = ?;`
    const tweet = await db.get(tweetQuery, [tweetId])

    if (!tweet || tweet.user_id !== user.user_id) {
      return response.status(401).send('Invalid Request') // User cannot delete others' tweets
    }

    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id = ?;`
    await db.run(deleteTweetQuery, [tweetId])

    response.send('Tweet Removed')
  },
)

module.exports = app-
