(function() {
  return {
    defaultState: 'loading',
    requests: {
      createSubTask: function(data){
        return {
          url: '/api/v2/tickets.json',
          type: 'POST',
          dataType: 'json',
          processData: false,
          contentType: 'application/json',
          data: JSON.stringify(data)
        };
      },

      updateCurrentTicket: function(data){
        return {
          url: helpers.fmt('/api/v2/tickets/%@.json', this.ticket().id()),
          type: 'PUT',
          dataType: 'json',
          data: JSON.stringify(data),
          processData: false,
          contentType: 'application/json'
        };
      },

      fetchTickets: function(ids){
        return {
          url: helpers.fmt('/api/v2/tickets/show_many.json?ids=%@', ids),
          dataType: 'json'
        };
      }
    },

    events: {
      'app.activated'           : 'onAppActivated',
      // DOM EVENTS
      'click form button'       : 'createSubTasks'
    },

    onAppActivated: function(app) {
      if (app.firstLoad) {
        _.defer(this.initialize.bind(this));
      }
    },

    initialize: function() {
      var ancestryField = this.ticketFields(this.ancestryFieldLabel());

      if (ancestryField) {
        ancestryField.hide();

        if (this.ancestry()) {
          this.hasAncestry();
        } else {
          this.hasNoAncestry();
        }
      }
    },

    hasNoAncestry: function(){
      return this.switchTo('new', {
        options: this.formattedTemplateOptions(this.configuration().templates)
      });
    },

    hasAncestry: function(){
      if (this.hasParent()){
        this.ajax('fetchTickets', [ this.ancestry().parent.id ])
          .done(function(data){
            this.switchTo('parent', { ticket: data.tickets[0] });
          });
      } else if (this.hasChildren()){
        this.ajax('fetchTickets', this.ancestry().children)
          .done(function(data){
            this.switchTo('children', { tickets: data.tickets });
          });
      }
    },

    createSubTasks: function(){
      var tasks = this.configuration()
        .templates[this.selectedTaskTemplate()]
        .tasks;

      this.switchTo('loading');

      this.when.apply(
        this,
        _.map(tasks, function(task_name) {
          var task = this.configuration().tasks[task_name];

          var taskJson = this.taskAsJson({
            task: task,
            ticket: this.ticket(),
            data_field: this.setting('data_field')
          });

          return this.ajax('createSubTask', taskJson);
        }, this)
      ).done(function() {
        var args = Array.prototype.slice.call(arguments),
        parsedArgs = _.map((tasks.length > 1 ? args : [ args ]), function(r) {
          return r[0];
        }),
        tickets = _.map(parsedArgs, function(arg) {
          return arg.ticket;
        }),
        children = _.map(tickets, function(ticket) {
          return ticket.id;
        });

        this.saveAncestry(children);
        this.switchTo('children', { tickets: tickets });
      }.bind(this));
    },

    formattedTemplateOptions: function(templates){
      return _.reduce(templates,
                      function(memo,value,key){
                        memo.push({value: key, name: value.label});

                        return memo;
                      },[]);
    },

    taskAsJson: function(params){
      var task = {
        ticket: {
          subject: params.task.label + " for " + params.ticket.subject() + " (#"+ params.ticket.id() +")",
          comment: {
            body: params.task.description
          },
          custom_fields: [
            {
              id: Number(params.data_field),
              value: JSON.stringify({
                parent: {
                  id: params.ticket.id()
                }})
            }
          ]
        }
      };

      return task;
    },


    saveAncestry: function(children){
      var ancestry = JSON.stringify({ children: children });
      var data = { ticket: { custom_fields: [
        { id: Number(this.setting('data_field')), value: ancestry }
      ] } };

      this.ticket().customField(this.ancestryFieldLabel(),
                                ancestry);

      this.ajax('updateCurrentTicket', data);
    },

    hasParent: function(){
      return _.has(this.ancestry(), "parent");
    },

    hasChildren: function(){
      return _.has(this.ancestry(), "children");
    },

    selectedTaskTemplate: function(){
      return this.$('form select').val();
    },

    ancestry: function(){
      var ancestry_content = this.ticket().customField(this.ancestryFieldLabel());

      if (_.isUndefined(ancestry_content))
        return;
      return JSON.parse(ancestry_content);
    },

    ancestryFieldLabel: function(){
      return "custom_field_" + this.setting('data_field');
    },

    configuration: function(){
      return JSON.parse(this.setting('configuration'));
    }
  };

}());
