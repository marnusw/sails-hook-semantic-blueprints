# sails-hook-semantic-blueprints

Adds two additional Blueprint routes which are necessary to realise the full 
[Semantic Interface](https://github.com/balderdashy/waterline-adapter-tests/tree/master/interfaces/semantic)
according to the [Waterline ORM](https://github.com/balderdashy/waterline) 
[Adapter specifications](https://github.com/balderdashy/sails-docs/blob/master/contributing/adapter-specification.md).

## Installation

In Sails.js v0.11+ installed hooks are run automatically. Therefore, simply install the hook via `npm`:

    npm install sails-hook-semantic-blueprints

## findAndUpdate

    PUT /:model

The typical criteria including `where`, `limit`, `skip` and `sort` can be provided in the request body along with
either a `data` or `values` property. All records that match the criteria will be updated with the data/values.
 
*Note:* The limit, skip and sort options do not apply to the records that will be updates, but merely affects the
 record set that will be returned to the client. *All* records matching the criteria *will* be updated.

## findAndDestroy

    DELETE /find-n-destroy/:model

The typical criteria including `where`, `limit`, `skip` and `sort` can be provided in the request body. All 
records that match the criteria will be deleted permanently. 

*Note:* The limit, skip and sort options do not apply to the records that will be deleted, but merely affects the
 record set that will be returned to the client. *All* records matching the criteria *will* be deleted.

The findAndDestroy route is messy, especially when there is a URL prefix, because Sails.js already binds 
`delete /:model` via the `/id?` postfix to the Blueprint core delete method which only handles one record at a time.

## License

This software is free to use under the MIT license.
See the [LICENSE file][] for license text and copyright information.

[LICENSE file]: https://github.com/marnusw/fluxible-plugin-waterline-models/blob/master/LICENSE.md
