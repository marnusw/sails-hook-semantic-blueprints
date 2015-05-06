/**
 * Module dependencies
 */
'use strict';
var _ = require('lodash');
var actionUtil = require('../actionUtil');
var wlFilter = require('waterline-criteria');


/**
 * Destroy All Records matching the search parameters on `where`.
 *
 * An API call to destroy multiple model instances.
 *
 * @param {Object} criteria - the criteria used in the search and to limit the response,
 *  typical where, limit, skip, and sort options.
 *  These options DO NOT limit the records that will be deleted! Only the records that are returned.
 * @param *                 - values to set on the record
 *
 */
module.exports = function findAndDestroyRecords(req, res) {

  // Look up the model
  var Model = actionUtil.parseModel(req);

  // Look up the search criteria
  var where = actionUtil.parseCriteria(req);


  // Perform the updates based on the search criteria
  Model.destroy(where).exec(function destroyed(err, records) {

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
    // to notify all subscribers about the destroy.
    if (req._sails.hooks.pubsub) {
      var omitReq = !req.options.mirror && req;
      _.each(records, function(record) {
        Model.publishDestroy(record.id, omitReq, {previous: record});
        if (req.isSocket) {
          Model.unsubscribe(req, record);
          Model.retire(record);
        }
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
