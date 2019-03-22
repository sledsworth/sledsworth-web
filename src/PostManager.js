const _ = require('lodash')
const Fuse = require('fuse.js')
const md = require('markdown-it')({
    html: true,
    xhtmlOut: true,
    typographer: true,
  })
  .use(require('markdown-it-footnote'))
  .use(require('markdown-it-highlightjs'))
  .use(
    require('markdown-it-video', {
      youtube: {
        width: 640,
        height: 390,
      },
    })
  )
const {
  METADATA_TAG
} = require('./constants')
const {
  getDateFromFilePath,
  numberToMonth
} = require('./DateUtility')

class PostManager {
  constructor() {
    this.cachedPages = {}
    this.cachedPosts = {}

    this.isFileAValidPage = this.isFileAValidPage.bind(this)
    this.isFileAValidPost = this.isFileAValidPost.bind(this)
    this.addPagesToCache = this.addPagesToCache.bind(this)
    this.addPostsToCache = this.addPostsToCache.bind(this)
    this.createLinks = this.createLinks.bind(this)
    this.buildPageFromContents = this.buildPageFromContents.bind(this)
    this.buildPostFromContents = this.buildPostFromContents.bind(this)
    this.splitFileContents = this.splitFileContents.bind(this)
    this.getPostFromDate = this.getPostFromDate.bind(this)
    this.updateContentsOfItem = this.updateContentsOfItem.bind(this)
    this.removeItem = this.removeItem.bind(this)
    this.getPage = this.getPage.bind(this)
    this.getFrontPage = this.getFrontPage.bind(this)
    this.getAllPosts = this.getAllPosts.bind(this)
    this.getPostAt = this.getPostAt.bind(this)
    this.getPostsByYear = this.getPostsByYear.bind(this)
    this.getPostsByMonth = this.getPostsByMonth.bind(this)
    this.findPostsBasedOnSearch = this.findPostsBasedOnSearch.bind(this)
  }

  /**
   *  Takes a markdown file contents and parses out the ehader, body, and metadata.
   * Does not render the contents with markdown it yet.
   *
   * @param {string} fileContents - markdown file contents
   *
   * @returns {
   * metadata: any line that starts with `@:`, parsed as: key=some value
   * header: post top level header.
   * body: the rest of the lines in the file
   * } the contents of a file parsed as metadata, body, and header.
   * Not rendered markdown yet.
   */
  splitFileContents(fileContents) {
    const lines = fileContents.split(/\n/g)
    return _.reduce(
      lines,
      (acc, line) => {
        if (line.trim().startsWith(METADATA_TAG)) {
          const [name, contents] = line
            .trim()
            .substring(2)
            .split(/@:|=/g)
          return {
            ...acc,
            metadata: {
              ...acc.metadata,
              [name]: contents,
            },
          }
        } else if (line.trim().startsWith('# ') && !acc.header) {
          const headerContainsLink = /(?:__|[*])|\[(.*?)\]\(.*?\)/g.test(line)
          const title = headerContainsLink ?
            line.substring(line.indexOf('[') + 1, line.indexOf(']')) :
            line.substring(2)
          return {
            ...acc,
            metadata: {
              ...acc.metadata,
              isLinkHeader: headerContainsLink,
              title,
            },
            header: line,
          }
        }
        return {
          ...acc,
          body: acc.body.concat(`${line}\n`),
        }
      }, {
        metadata: {},
        header: '',
        body: '',
      }
    )
  }

  /**
   * Tests that the file name is in the proper format we expect the post filenames to match.
   *
   * @param {string} filePath name of file
   * @returns {bool} true if file name matchs the format of Some-Title.md, else false
   */
  isFileAValidPage(filePath) {
    const fileNamePattern = /^([A-Za-z0-9\-_]+)\.md$/g
    return fileNamePattern.test(filePath)
  }

  /**
   * Tests that the file name is in the proper format we expect the page filenames to match.
   *
   * @param {string} filePath name of file
   * @returns {bool} true if file name matchs the format of YYYY/MM/DD/Some-Title.md, else false
   */
  isFileAValidPost(filePath) {
    const fileNamePattern = /(\d{4})\/(\d{1,2})\/(\d{1,2})\/([\S]+)\.md/
    return fileNamePattern.test(filePath)
  }

  createLinks(path) {
    return {
      markdownLink: '' + path,
      link: '' + path.replace('.md', ''),
    }
  }

  buildPostFromContents(contents) {
    const {
      body: unRenderedBody,
      header: unRenderedHeader,
      metadata,
    } = this.splitFileContents(contents.contentText)
    const date = getDateFromFilePath(contents.path)
    return {
      path: contents.path,
      body: md.render(unRenderedBody, {
        docId: _.kebabCase(contents.path),
      }),
      header: md.render(unRenderedHeader),
      metadata: {
        ...metadata,
        ...this.createLinks(contents.path),
      },
      date,
    }
  }

  buildPageFromContents(contents) {
    const {
      body: unRenderedBody,
      header: unRenderedHeader,
      metadata,
    } = this.splitFileContents(contents.contentText)
    return {
      path: contents.path,
      body: md.render(unRenderedBody, {
        docId: _.kebabCase(contents.path),
      }),
      header: md.render(unRenderedHeader),
      metadata: {
        ...metadata,
        ...this.createLinks(contents.path),
      },
    }
  }

  addPagesToCache(pages) {
    this.cachedPages = _.keyBy(pages, page => page.metadata.link)
    // console.log(this.cachedPages)
  }

  addPostsToCache(posts) {
    this.cachedPosts = _.reduce(
      posts,
      (acc, post) => {
        return _.setWith(acc, post.metadata.link.split('/'), post, Object)
      }, {}
    )
  }

  getPostFromDate(year, month) {
    if (month) {
      return _.toArray(_.get(this.cachedPosts, `[${year}][${month}]`))
    }
    return _.toArray(_.get(this.cachedPosts, `[${year}]`))
  }

  updateContentsOfItem(item) {
    if (this.isFileAValidPost(item.path)) {
      const post = this.buildPostFromContents(item)
      _.setWith(this.cachedPosts, post.metadata.link.split('/'), post, Object)
    } else if (this.isFileAValidPage(item.path)) {
      const page = this.buildPageFromContents(item)
      this.cachedPages[page.metadata.link] = page
    }
    return item
  }

  removeItem(path) {
    if (this.isFileAValidPost(path)) {
      const variablePath = path.replace(/.md/g, '').replace(/\//g, '.')
      this.cachedPosts = _.omit(this.cachedPosts, variablePath)
    } else if (this.isFileAValidPage(path)) {
      const variablePath = path.replace(/.md/g, '').replace(/\//g, '.')
      this.cachedPages = _.omit(this.cachedPages, variablePath)
    }
    return path
  }

  findPostsBasedOnSearch(search) {
    const options = {
      shouldSort: true,
      threshold: 0.6,
      location: 0,
      distance: 10000,
      maxPatternLength: 32,
      minMatchCharLength: 4,
      keys: [{
          name: 'metadata.title',
          weight: 0.9,
        },
        {
          name: 'body',
          weight: 0.6,
        },
      ],
    }
    const fuse = new Fuse(this.getAllPosts(), options)
    return fuse.search(search)
  }

  getPage(path) {
    return this.cachedPages[path]
  }

  getFrontPage() {
    return this.getAllPosts()
  }

  getArchivePosts() {
    return _.reduce(this.cachedPosts, (acc, value, year) => {
      return { ...acc,
        [year]: this.getMonthNames(year)
      }
    }, {})
  }

  getMonthNames(year) {
    return _.reduce(year, (acc, value, month) => {
      return { ...acc,
        [numberToMonth(month)]: value
      }
    }, {})
  }

  getAllPosts() {
    return _.orderBy(
      _.flatMap(this.cachedPosts, (yearOfPosts, year) => {
        return _.flatMap(yearOfPosts, (monthOfPosts, month) => {
          return _.flatMap(monthOfPosts, (dayOfPosts, day) => {
            return _.flatMap(dayOfPosts)
          })
        })
      }),
      ['date.year', 'date.month', 'date.day'],
      ['desc', 'desc', 'desc']
    )
  }

  getPostAt(year, month, day, name) {
    console.log(this.getAllPosts())
    return _.get(this.cachedPosts, `[${year}][${month}][${day}][${name}]`)
  }

  getPostsByYear(year) {
    const yearOfPosts = _.get(this.cachedPosts, `[${year}]`)
    return _.flatMap(yearOfPosts, (monthOfPosts, month) => {
      return _.flatMap(monthOfPosts, (dayOfPosts, day) => {
        return _.flatMap(dayOfPosts)
      })
    })
  }

  getPostsByMonth(year, month) {
    const monthOfPosts = _.get(this.cachedPosts, `[${year}][${month}]`)
    return _.flatMap(monthOfPosts, (dayOfPosts, day) => {
      return _.flatMap(dayOfPosts)
    })
  }
}

module.exports = new PostManager()