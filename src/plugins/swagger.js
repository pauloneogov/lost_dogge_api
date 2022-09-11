import fp from 'fastify-plugin'
import Swagger from 'fastify-swagger'

import { CONTENT_TYPE } from '../constants'

async function swaggerGenerator (fastify, opts) {
  fastify.register(Swagger, {
    routePrefix: '/doc',
    swagger: {
      info: {
        title: 'Lost Dogge',
        description: 'Custom rest api for lost dogge',
        version: '1.0.0'
      },
      schemes: ['https', 'http'],
      consumes: [CONTENT_TYPE.JSON],
      produces: [CONTENT_TYPE.JSON, CONTENT_TYPE.HTML]
    },
    exposeRoute: fastify.config.NODE_ENV !== 'production'
  })
}

export default fp(swaggerGenerator, {
  name: 'swaggerGenerator'
})
