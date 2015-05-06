/**
 * Copied from the Sails.js Blueprints Hook. The only change is that user routes aren't loaded
 * with the module loader since the Blueprint Hook itself handles that.
 */
'use strict';
var _ = require('lodash');
var util = require('util');
var nodePath = require('path');
var pluralize = require('pluralize');
var BlueprintController = {
  findAndDestroy: require('./actions/findAndDestroy'),
  findAndUpdate: require('./actions/findAndUpdate')
};


/**
 * Blueprints (Core Hook)
 *
 * Stability: 1 - Experimental
 * (see http://nodejs.org/api/documentation.html#documentation_stability_index)
 */

module.exports = function(sails) {

  var hook;

  /**
   * Expose blueprint hook definition
   *
   * (The same blueprint configuration applies, therefore no Blueprint defaults are specified here.)
   */
  return {

    /**
     * Initialize is fired first thing when the hook is loaded.
     *
     * @param  {Function} cb
     */
    initialize: function(cb) {

      // Provide hook context to closures
      hook = this;

      // Set up listener to bind shadow routes when the time is right.
      //
      // Always wait until after router has bound static routes.
      // If policies hook is enabled, also wait until policies are bound.
      // If orm hook is enabled, also wait until models are known.
      // If controllers hook is enabled, also wait until controllers are known.
      var eventsToWaitFor = [];
      eventsToWaitFor.push('router:after');
      if (sails.hooks.policies) {
        eventsToWaitFor.push('hook:policies:bound');
      }
      if (sails.hooks.orm) {
        eventsToWaitFor.push('hook:orm:loaded');
      }
      if (sails.hooks.controllers) {
        eventsToWaitFor.push('hook:controllers:loaded');
      }
      sails.after(eventsToWaitFor, hook.bindShadowRoutes);


      // Load blueprint middleware and continue.

      // Add _middlewareType keys to the functions, for debugging
      _.each(BlueprintController, function(fn, key) {
        fn._middlewareType = 'BLUEPRINT: ' + fn.name || key;
      });

      // Save reference to blueprints middleware in hook.
      hook.middleware = BlueprintController;

      // When our app's controllers are finished loading,
      // merge the blueprint actions into each of them as defaults.
      sails.once('middleware:registered', hook.extendControllerMiddleware);

      cb();
    },

    extendControllerMiddleware: function() {
      _.each(sails.middleware.controllers, function(controller) {
        _.defaults(controller, hook.middleware);
      });
    },

    bindShadowRoutes: function() {

      _.each(sails.middleware.controllers, function eachController(controller, controllerId) {
        if (!_.isObject(controller) || _.isArray(controller)) {
          return;
        }

        // Get globalId for use in errors/warnings
        var globalId = sails.controllers[controllerId].globalId;

        // Determine blueprint configuration for this controller
        var config = _.merge({},
          sails.config.blueprints,
          controller._config || {});

        // Validation of the config is done in the Blueprints hook, so it's not repeated here.


        // Determine base route
        var baseRoute = config.prefix + '/' + controllerId;
        // Determine base route for RESTful service
        var baseRestRoute = nodePath.normalize(config.prefix + config.restPrefix + '/' + controllerId);

        if (config.pluralize) {
          baseRoute = pluralize(baseRoute);
          baseRestRoute = pluralize(baseRestRoute);
        }

        // Build route options for blueprint
        var routeOpts = config;

        // Determine the model connected to this controller either by:
        // -> explicit configuration
        // -> on the controller
        // -> on the routes config
        // -> or implicitly by globalId
        // -> or implicitly by controller id
        var routeConfig = sails.router.explicitRoutes[controllerId] || {};
        var modelFromGlobalId = sails.util.findWhere(sails.models, {globalId: globalId});
        var modelId = config.model || routeConfig.model ||
          (modelFromGlobalId && modelFromGlobalId.identity) || controllerId;

        // If the orm hook is enabled, it has already been loaded by this time,
        // so just double-check to see if the attached model exists in `sails.models`
        // before trying to attach any CRUD blueprint actions to the controller.
        if (sails.hooks.orm && sails.models && sails.models[modelId]) {

          // If a model with matching identity exists,
          // extend route options with the id of the model.
          routeOpts.model = modelId;

          var Model = sails.models[modelId];

          // Bind convenience functions for readability below:

          // Given an action id like "find" or "create", returns the appropriate
          // blueprint action (or explicit controller action if the controller
          // overrode the blueprint CRUD action.)
          var _getAction = _.partial(_getMiddlewareForShadowRoute, controllerId);

          // Returns a customized version of the route template as a string.
          var _getRoute = _.partialRight(util.format, baseRoute);

          var _getRestRoute = _getRoute;
          if (config.restPrefix) {
            // Returns a customized version of the route template as a string for REST
            _getRestRoute = _.partialRight(util.format, baseRestRoute);
          }


          // Mix in the known associations for this model to the route options.
          routeOpts = _.merge({associations: _.cloneDeep(Model.associations)}, routeOpts);

          // Binds a route to the specified action using _getAction, and sets the action and controller
          // options for req.options
          var _bindRoute = function(path, action, options) {
            options = options || routeOpts;
            options = _.extend({}, options, {action: action, controller: controllerId});
            sails.router.bind(path, _getAction(action), null, options);

          };

          // Bind URL-bar "shortcuts"
          // (NOTE: in a future release, these may be superceded by embedding actions in generated controllers
          //  and relying on action blueprints instead.)
          if (config.shortcuts) {
            sails.log.silly('Binding extended shortcut blueprint/shadow routes for model ', modelId,
              ' on controller:', controllerId);

            _bindRoute(_getRoute('%s/find-and-update'), 'findAndUpdate');
            _bindRoute(_getRoute('%s/find-and-destroy'), 'findAndDestroy');
          }

          // Bind "rest" blueprint/shadow routes
          if (config.rest) {
            sails.log.silly('Binding extended RESTful blueprint/shadow routes for model+controller:', controllerId);

            _bindRoute(_getRestRoute('put %s'), 'findAndUpdate');
            // The findAndDestroy route is messy because Sails.js already binds `delete /:model` via `/id?`
            var findAndDestroyRoute = config.prefix + config.restPrefix + '/find-n-destroy/' + controllerId;
            _bindRoute('delete ' + findAndDestroyRoute, 'findAndDestroy');
          }
        }
      });


      /**
       * Return the middleware function that should be bound for a shadow route
       * pointing to the specified blueprintId. Will use the explicit controller
       * action if it exists, otherwise the blueprint action.
       *
       * @param  {String} controllerId
       * @param  {String} blueprintId  [find, create, etc.]
       * @return {Function}            [middleware]
       */
      function _getMiddlewareForShadowRoute(controllerId, blueprintId) {

        // Allow custom actions defined in controller to override blueprint actions.
        return sails.middleware.controllers[controllerId][blueprintId.toLowerCase()] || hook.middleware[blueprintId];
      }
    }

  };

};

