require('isomorphic-fetch')
const express = require('express'),
  bodyParser = require('body-parser'),
  path = require('path'),
  cookieParser = require('cookie-parser'),
  version = require('../package.json').version,
  _ = require('lodash'),
  favicon = require('serve-favicon')

const GithubService = require('./GithubService.js')
const PostManager = require('./PostManager.js')
const { numberToMonth } = require('./DateUtility')
const baseGithubUri = 'https://api.github.com'

const Github = new GithubService({
  baseUri: baseGithubUri,
  token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
})
const app = express()

app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*')
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  )
  next()
})
app.use(bodyParser.json())
app.use(bodyParser.urlencoded())
app.use(
  bodyParser.text({
    type: 'text/html',
    encoding: 'UTF8',
  })
)
app.use(favicon(path.join(__dirname, 'public/images', 'logo.ico')))
app.set('views', __dirname + '/views')
app.set('view engine', 'pug')
app.use(express.static(path.join(__dirname, '/public')))
app.use(cookieParser())

/**
 * Routes
 */
app.get('/', function(req, res) {
  res.render('index', {
    posts: PostManager.getFrontPage(),
    year: new Date().getFullYear(),
    route: '',
    showPageLink: true,
  })
})

app.get('/*.html', function(req, res) {
  res.sendFile(__dirname + '/views/google2887d1f7bafc06b0.html')
})

app.get('/search', function(req, res) {
  const search = req.query.search
  let foundPosts = []
  if (search) {
    foundPosts = PostManager.findPostsBasedOnSearch(search)
  }
  res.render('search', {
    posts: foundPosts,
    year: new Date().getFullYear(),
    route: 'search',
    lastSearch: search || '',
    triedSearch: !!search,
  })
})

app.get('/:year/', function(req, res, next) {
  const currentYear = new Date().getFullYear()
  const year = parseInt(req.params.year)
  const isYear = _.isInteger(year) && year <= currentYear
  if (isYear) {
    const foundPosts = PostManager.getPostsByYear(year)

    if (foundPosts.length > 0) {
      res.render('index', {
        pageHeading: `Posts from ${year}:`,
        posts: foundPosts,
        year: currentYear,
        route: '',
      })
    } else {
      res.render('error', {
        description:
          "I tried my best to find this post... I really did! Unfortunantly, it doesn't seem to exist ¯\\_(ツ)_/¯",
        title: 'This is not the page you are looking for...',
        year: new Date().getFullYear(),
      })
    }
  } else {
    next('route')
  }
})

app.get('/:year/:month', function(req, res, next) {
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1
  const year = parseInt(req.params.year)
  const month = parseInt(req.params.month)
  const isMonth =
    _.isInteger(month) && (currentYear !== year || month <= currentMonth)
  const isYear = _.isInteger(year) && year <= currentYear
  if (isYear && isMonth) {
    const foundPosts = PostManager.getPostsByMonth(year, month)
    if (foundPosts.length > 0) {
      res.render('index', {
        pageHeading: `Posts from ${numberToMonth(month)}, ${year}:`,
        posts: foundPosts,
        year: currentYear,
        route: '',
      })
    } else {
      res.render('error', {
        description:
          "I tried my best to find this post... I really did! Unfortunantly, it doesn't seem to exist ¯\\_(ツ)_/¯",
        title: 'This is not the page you are looking for...',
        year: new Date().getFullYear(),
      })
    }
  } else {
    next('route')
  }
})

app.get('/:year/:month/:day/:postTitle', function(req, res) {
  const post = PostManager.getPostAt(
    req.params.year,
    req.params.month,
    req.params.day,
    req.params.postTitle
  )
  if (post) {
    res.render('article', {
      post,
      year: new Date().getFullYear(),
    })
  } else {
    res.render('error', {
      description:
        "I tried my best to find this post... I really did! Unfortunantly, it doesn't seem to exist ¯\\_(ツ)_/¯",
      title: 'This is not the page you are looking for...',
      year: new Date().getFullYear(),
    })
  }
})

app.get('/archive', function(req, res) {
  res.render(
    'archive',
    {
      year: new Date().getFullYear(),
      archives: PostManager.cachedPosts,
      route: 'archive',
      toMonth: {
        1: 'January',
        2: 'February',
        3: 'March',
        4: 'April',
        5: 'May',
        6: 'June',
        7: 'July',
        8: 'August',
        9: 'September',
        10: 'October',
        11: 'November',
        12: 'December',
      },
    },
    (err, html) => {
      if (err) {
        console.log(err)
        res.render('error', {
          title: 'Page Not Found',
          description: 'Sorry about that!',
          error: err.Error,
          year: new Date().getFullYear(),
        })
      } else {
        res.send(html)
      }
    }
  )
})

app.get('/:viewname', function(req, res) {
  const view = PostManager.getPage(req.params.viewname)
  // console.log(view)
  if (view) {
    res.render(
      'template',
      {
        year: new Date().getFullYear(),
        route: req.params.viewname,
        tabTitle: req.params.viewname,
        header: view.header,
        body: view.body,
        metadata: view.metadata,
        lastSearch: '',
      },
      (err, html) => {
        if (err) {
          console.log(err)
          res.render('error', {
            title: 'Page Not Found',
            description: 'Sorry about that!',
            error: err.Error,
            year: new Date().getFullYear(),
          })
        } else {
          res.send(html)
        }
      }
    )
  }
})

app.get('*', function(req, res) {
  res.status = 404
  res.render('error', {
    title: 'Page Not Found',
    description: 'Sorry about that!',
    year: new Date().getFullYear(),
  })
})

app.post('/payload', function(req, res) {
  if (req.body.ref.includes(process.env.GITHUB_BRANCH)) {
    const commits = req.body.commits
    const modifiedFiles = commits.reduce((acc, commit) => {
      return _.union(acc, commit.modified, commit.added)
    }, [])
    const removedFiles = commits.reduce((acc, commit) => {
      return _.union(acc, commit.removed)
    }, [])
    removedFiles.map(PostManager.removeItem)
    modifiedFiles.map(path =>
      Github.fetchContent({
        path: path,
        owner: process.env.GITHUB_REPO_OWNER,
        repository: process.env.GITHUB_POST_REPO,
        decode: true,
      }).then(PostManager.updateContentsOfItem)
    )
  }
  res.status(200)
  res.send()
})

function getInitialContent() {
  return Github.fetchTree({
    owner: 'sledsworth',
    repository: 'empatheticbot',
  }).then(
    response => {
      let posts = _.filter(
        response.tree,
        item => item.type === 'blob' && PostManager.isFileAValidPost(item.path)
      )
      let pages = _.filter(
        response.tree,
        item => item.type === 'blob' && PostManager.isFileAValidPage(item.path)
      )
      let postsFetches = Promise.all(
        posts.map(item =>
          Github.fetchContent({
            path: item.path,
            owner: process.env.GITHUB_REPO_OWNER,
            repository: process.env.GITHUB_POST_REPO,
            decode: true,
          }).then(PostManager.buildPostFromContents)
        )
      ).then(PostManager.addPostsToCache)

      let pageFetches = Promise.all(
        pages.map(item =>
          Github.fetchContent({
            path: item.path,
            owner: process.env.GITHUB_REPO_OWNER,
            repository: process.env.GITHUB_POST_REPO,
            decode: true,
          }).then(PostManager.buildPageFromContents)
        )
      ).then(PostManager.addPagesToCache)

      return Promise.all([pageFetches, postsFetches])
    },
    error => console.log(error)
  )
}

getInitialContent().then(
  () =>
    app.listen(process.env.PORT || 5000, function() {
      console.info('Started selBlogger, version ', version)
      console.info('At: ', `localhost:${process.env.PORT}`)
    }),
  error => console.log(error)
)
