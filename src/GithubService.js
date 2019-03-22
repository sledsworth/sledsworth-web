const fetch = require('isomorphic-fetch')

class HttpException extends Error {
  constructor({
    message,
    status,
    statusText,
    url
  }) {
    super(message)
    this.status = status
    this.statusText = statusText
    this.url = url
  }
}

class GithubService {
  constructor({
    baseUri,
    token
  }, ...features) {
    this.baseUri = baseUri
    this.credentials = token && token.length > 0 ? `token ${token}` : null
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
      Authorization: this.credentials,
    }
    return Object.assign(this, ...features)
  }

  callGitHubAPI({
    method,
    path,
    data,
    ref = process.env.GITHUB_BRANCH
  }) {
    let _response = {}
    return fetch(this.baseUri + path + `?ref=${ref}`, {
        method: method,
        headers: this.headers,
        body: data !== null ? JSON.stringify(data) : null,
      })
      .then(response => {
        _response = response
        // if response is ok transform response.text to json object
        // else throw error
        if (response.ok) {
          return response.json()
        } else {
          throw new HttpException({
            message: `HttpException[${method}]`,
            status: response.status,
            statusText: response.statusText,
            url: response.url,
          })
        }
      })
      .then(jsonData => {
        _response.data = jsonData
        return _response
      })
  }

  getData({
    path
  }) {
    return this.callGitHubAPI({
      method: 'GET',
      path,
      data: null
    })
  }

  deleteData({
    path
  }) {
    return this.callGitHubAPI({
      method: 'DELETE',
      path,
      data: null
    })
  }

  postData({
    path,
    data
  }) {
    return this.callGitHubAPI({
      method: 'POST',
      path,
      data
    })
  }

  putData({
    path,
    data
  }) {
    return this.callGitHubAPI({
      method: 'PUT',
      path,
      data
    })
  }

  fetchContent({
    path,
    owner,
    repository,
    decode = false
  }) {
    return this.getData({
      path: `/repos/${owner}/${repository}/contents/${path}`,
    }).then(response => {
      if (decode === true) {
        response.data.contentText = new Buffer(
          response.data.content,
          response.data.encoding
        ).toString('utf8')
      }
      return response.data
    })
  }

  fetchTree({
    owner,
    repository,
    sha = process.env.GITHUB_BRANCH,
    recursive = 3
  }) {
    return this.getData({
      path: `/repos/${owner}/${repository}/git/trees/${sha}?recursive=${recursive}`,
    }).then(response => {
      return response.data
    })
  }

  searchCode({
    q
  }) {
    return this.getData({
      path: `/search/code?q=${q}`
    }).then(response => {
      return response.data
    })
  }
}

module.exports = GithubService