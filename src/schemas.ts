export const createEtherpad = {
  querystring: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  body: {
    type: 'object',
    properties: {
      name: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    required: ['name'],
    additionalProperties: false,
  },
};

export const getEtherpadFromItem = {
  querystring: {
    mode: {
      type: 'string',
      enum: ['read', 'write'],
    },
    additionalProperties: false,
  },
  params: {
    type: 'object',
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    required: ['itemId'],
    additionalProperties: false,
  },
};
