'use strict'

const inflect = require('i')()
const Validator = use('Adonis/Addons/Validator')
const Database = use('Database')

class RestController {
  
  get config() {
    return {
      index: {
        pagination: true,
        // hidden: 'updated_at',
        // extra: 'body',
        // expand: 'user',
      },
      detail: {
        // expand: 'user'
      }
    }
  }

  * prepare (request, response) {
    this.resourceName = request.param('resource')
    this.Model = this.resource(this.resourceName)
    this.id = request.param('id', request.input('id'))
  }

  * columns(table) {
    return yield Database.table(table).columnInfo()
  }

  // create - POST /api/:resource
  * store(request, response) {
    yield this.prepare(request)
    const model = new this.Model()
    yield this.save(model, request, response)
  }

  * save(model, request, response) {
    const data = request.all()
    let result
    model.fill(data)
    if (model.rules) {
      let rules = typeof model.rules === 'function' ? model.rules() : model.rules
      let messages = typeof model.messages === 'function' ? model.messages() : model.messages
      const validation = yield Validator.validateAll(data, rules, messages)
      if (validation.fails()) {
        return response.status(422).json(validation.messages())
      }
    }
    try {
      result = yield model.save()
    } catch (e) {
      return response.status(400).send({
        code: e.code,
        message: e.message
      })
    }
    response.json(model.toJSON())
  }
  split(val){
    return val ? val.split(/\s*,\s*/) : []
  }
  // readMany - GET /api/:resource
  * index(request, response) {
    yield this.prepare(request)
    const parentResource = request.param('parent')
    const parent = this.resource(parentResource)
    const parentId = request.param('parentId')
    let parentInstance
    let query = this.Model.query()
    if (parent && parentId) {
      parentInstance = parent.findOrFail(parentId)
      const field = inflect.foreign_key(inflect.singularize(parentResource))
      // query = parentInstance[request.param('resource')]
      query.where(field, parentId)
    }
    let filter = JSON.parse(request.input('query', request.input('filter', request.input('where'))))
    let offset = request.input('offset', request.input('skip', 0))
    let limit = request.input('perPage', request.input('limit', this.params.defaultPerPage))

    let page = Math.max(1, request.input('page', Math.floor(offset / limit) + 1))

    let fields = request.input('fields', this.config.index.fields)
    let hidden = request.input('hidden', this.config.index.hidden)
    let extra = request.input('extra', this.config.index.extra)
    let expand = request.input('related', request.input('expand', this.config.index.expand))
    let groupBy = request.input('groupBy')
    let orderBy = request.input('orderBy', request.input('sort'))
    let pagination = request.input('pagination', this.config.index.pagination)

    extra = this.split(extra)
    hidden = this.split(hidden)
    fields = this.split(fields)
    let columns = yield this.columns(this.Model.table)
    if (fields.length < 1) {
      let select = []
      for (let name in columns) {
        if (!hidden.includes(name) && (extra.includes(name) || columns[name].dataType != 'text')) {
          select.push(name)
        }
      }
      fields = select

      if (extra) {
        fields = fields.concat(extra)
      }
    }

    fields && query.select(fields)
    //expand=user,post(id,title)
    if (expand) {
      expand = expand.match(/[\w.]+(\(.+?\))?/ig)
      for (let name of expand) {
        if (name.indexOf('(') > -1) {
          let [none, rel, value] = name.match(/([\w.]+)\((.+?)\)/)
          // config = qs.parse(config) //{fields: 'id,title'}
          query.with(rel)
          query.scope(rel, query => {
            query.select(this.split(value))
          })
          // query.scope(rel, query => {
          //   for (let key in config) {
          //     let value = config[key]
          //     switch (key) {
          //       case 'fields':
          //         query.select(this.split(value))
          //         break;
          //       default:
          //         query[key](value)
          //     }
          //   }
          // })
        } else {
          query.with(name)
        }
      }
      // query.with(expand)
    }
    // groupBy && query.groupBy(groupBy)    
    if (orderBy) {
      let dir = 'asc'
      if (orderBy.substr(0, 1) === '-') {
        orderBy = orderBy.substr(1)
        dir = 'desc'
      }
      query.orderBy(orderBy, dir)
    }

    let conditions = []
    const requestData = request.all()

    const keys = 'page query filter per_page perPage limit offset skip where expand fields groupBy orderBy pagination sort extra hidden'.split(' ')
    // deal with fields filters 
    for (let name in requestData) {
      if (!keys.includes(name)) {
        query.where(name, requestData[name])
      }
    }
    for (let field in filter) {
      let condition = filter[field]
      if (condition === '') {
        continue
      }
      if (typeof condition === 'string') {
        //query={"title": "a"}
        query.where(field, 'like', `%${condition}%`)
      } else if (Array.isArray(condition)) {
        /**
         * query={"created_at": [">", "2017-07-07"]}
         * query={"created_at": ["between", ["2017-07-01", "2017-07-31"]]}
         * query={"user_id": ["in", [1,2,3] ]}
         * query={"user_id": ["raw", 'user_id = 10' ]}
         */
        let [operator, value] = condition
        let Operator = operator[0].toUpperCase() + operator.slice(1)
        if ([
          'Not',
          'In', 'NotIn',
          'Null', 'NotNull',
          'Exists', 'NotExists',
          'Between', 'NotBetween',
          'Raw'
        ].includes(Operator)) {
          query['where' + Operator](field, value)
        } else {
          query.where(field, operator, value)
        }
      } else {
        query.where(field, condition)
      }
    }
    let countQuery = query.clone().clearSelect()
    const count = yield countQuery.count('id as total')
    const total = count[0].total
    response.header('X-Pagination-Total-Count', total)
    response.header('X-Pagination-Page-Count', Math.ceil(total / limit))
    response.header('X-Pagination-Current-Page', page)
    response.header('X-Pagination-Per-Page', limit)
    let results
    if (['1', 'true'].includes(String(pagination))) {
      results = yield query.paginate(page, limit, countQuery)
    } else {
      results = yield query.offset(offset).limit(limit).fetch()
    }
    response.json(results)
  }

  // readOne - GET /api/:resource/:id
  * show(request, response) {
    yield this.prepare(request)
    const query = this.Model.query().where({ id: this.id })
    const expand = request.input('related', request.input('expand'))
    expand && query.with(expand)
    const result = yield query.first()
    response.json(result)
  }

  // update - PATCH /api/:resource/:id
  * update(request, response) {
    const instance = yield this.getInstance(request)
    yield this.save(instance, request, response)
  }

  // delete - DELETE /api/:resource/:id
  * destroy(request, response) {
    const instance = yield this.getInstance(request)
    const result = yield instance.delete()
    response.json(result)
  }

  // return model instance from :resource
  resource(resource) {
    if (this.model) {
      return this.model
    }
    if (!resource) {
      return
    }
    return use('App/Model/' + inflect.classify(resource))
  }

  get model() {

  }

  get params() {
    return {
      defaultPerPage: 10
    }
  }

  * getInstance(request) {
    yield this.prepare(request)
    const instance = yield this.Model.findOrFail(this.id)
    return instance
  }
}

module.exports = RestController
