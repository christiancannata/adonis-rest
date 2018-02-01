# adonis-rest
Restful api for AdonisJs 4

## Install

1. `npm install --save adonis4-api`


## Prepare
Tips: Please be sure that you have some models in `/app/Models/`.  Use `adonis make:model News` to create a News model if not.

> /app/Http/routes.js
``` javascript
Route.put('/api/:resource', 'RestController.update') //optional
Route.resource('/api/:resource', 'RestController')
```

> Create `/app/Http/Controllers/RestController.js`

``` javascript
'use strict'

const BaseRestController = require('adonis-rest')

class RestController  extends BaseRestController{

}

module.exports = RestController
```

That's all. Now you get all apis of your models.

## Documentations

> Base uri: `http://localhost:3333/api`


| METHOD | URL | DESCRIPTION |
| --- | --- | --- |
| GET | /news | Get all news |
| POST | /news | Create a news |
| PUT/PATCH | /news/:id | Update a news |
| DELETE | /news/:id | Delete a news |


### GET `/news`
Get all news

#### Url Query String

page query filter per_page perPage limit offset skip where expand fields groupBy orderBy pagination

| NAME | SAMPLE VALUE | DESCRIPTION |
| --- | --- | --- |
| pagination | 1 | Return data with pagination info if set any value, otherwise return the flat array. But you can retrive pagination info from reponse `headers` |
| query | {"user_id": 1} | Also you can use `filter` or `where` |
| page | 1 | Current Page |
| perPage | 10 | Also you can use `limit` |
| offset | 10 | Also you can use `skip` |
| fields | id,title,created_at | Fields for `select` |
| orderBy | id | Use `-id` for `desc` |

### Formats of `query`
- `query={"created_at": "2017-07-07"}`
- `query={"created_at": [">", "2017-07-07"]}` or `<`,`<>` etc
- `query={"created_at": ["between", ["2017-07-01", "2017-07-31"]]}` or `notBetween`
- `query={"user_id": ["in", [1,2,3] ]}` or `notIn`
- `query={"user_id": ["raw", 'user_id IS NULL' ]}`


## Any Problem?
Just tell me in `Issues`
