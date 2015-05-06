/**
 * Module dependencies
 */
'use strict';
var _ = require('lodash');
var actionUtil = require('../actionUtil');
var wlFilter = require('waterline-criteria');


/**
 * Update All Records matching the search parameters on `where`.
 *
 * An API call to update multiple model instances.
 *
 * @param {Object} criteria - the criteria used in the search and to limit the response,
 *  typical where, limit, skip, and sort options.
 *  These options DO NOT limit the records that will be deleted! Only the records that are returned.
 * @param *                 - values to set on the record
 *
 */
module.exports = function findAndUpdateRecords(req, res) {

  // Look up the model
  var Model = actionUtil.parseModel(req);

  // Look up the search criteria
  var where = actionUtil.parseCriteria(req);

  // Create `values` object (monolithic combination of all parameters)
  // But omit the blacklisted params (like JSONP callback param, etc.)
  var values = actionUtil.parseValues(req);

  // Since the criteria and values are all bundled in the request body
  // the data should arrive on a sub-property.
  values = values.data || values.values || values;

  // Omit the path parameter `id` from values, unless it was explicitly defined
  // elsewhere (body/query):
  var idParamExplicitlyIncluded = ((req.body && req.body.id) || req.query.id);
  if (!idParamExplicitlyIncluded) {
    delete values.id;
  }


  // Perform the updates based on the search criteria
  Model.update(where, values).exec(function updated(err, records) {

    // Differentiate between waterline-originated validation errors
    // and serious underlying issues. Respond with badRequest if a
    // validation error is encountered, w/ validation info.
    if (err) {
      return res.negotiate(err);
    }

    // If no records were found respond as such
    if (!records || !records.length) {
      return res.notFound();
    }


    // If we have the pubsub hook, use the Model's publish method
    // to notify all subscribers about the update.
    if (req._sails.hooks.pubsub) {
      if (req.isSocket) {
        Model.subscribe(req, records);
      }
      var changes = _.cloneDeep(values);
      var omitReq = !req.options.mirror && req;
      // Publish the updates, but since the previous values aren't readily available they're not included.
      _.each(records, function(record) {
        Model.publishUpdate(record.id, changes, omitReq);
      });
    }


    // Pull the criteria used to limit the records returned to the client
    // since returning all records could potentially not be practical.
    var criteria = {
      limit: actionUtil.parseLimit(req),
      skip: actionUtil.parseSkip(req),
      sort: actionUtil.parseSort(req)
    };

    // Return the limited record set to the client
    res.ok(wlFilter(records, criteria).results);
  });

};
