(function() {
  function formattedTemplateOptions(templates){
    return _.reduce(templates,
                    function(memo,value,key){
                      memo.push({value: key, name: value.label});

                      return memo;
                    },[]);
  }

  function taskAsJson(params){
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

    return JSON.stringify(task);
  }

  return {
    currentAncestry: { children: [] },
    createdSubTask: 0,
    subTaskToCreate: 0,
    createdTickets: [],

    requests: {
      createSubTask: function(data){
        return {
          url: '/api/v2/tickets.json',
          type: 'POST',
          dataType: 'json',
          processData: false,
          contentType: 'application/json',
          data: data
        };
      },
      updateTicket: function(params){
        return {
          url: '/api/v2/tickets/'+params.id+'.json',
          type: 'PUT',
          dataType: 'json',
          data: params.data
        };
      },
      fetchTickets: function(ids){
        return {
          url: '/api/v2/tickets/show_many?ids='+ids.join(',')+'.json',
          dataType: 'json'
        };
      }
    },

    events: {
      'app.activated'           : 'onActivated',
      'ticket.status.changed'   : 'loadIfDataReady',

      // DOM EVENTS
      'click form button'       : 'createSubTasks'
    },

    onActivated: function() {
      this.doneLoading = false;

      this.ticketFields(this.ancestryFieldLabel()).hide();

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if (!this.doneLoading &&
          this.ticket()){

        this.doneLoading = true;

        if (this.ancestry())
          return this.hasAncestry();
        return this.hasNoAncestry();
      }
    },

    hasNoAncestry: function(){
      return this.switchTo('new', {
        options: formattedTemplateOptions(this.configuration().templates)
      });
    },

    hasAncestry: function(){
      if (this.hasParent()){
        this.ajax('fetchTickets', [ this.ancestry().parent.id ])
          .done(function(data){
            this.switchTo('parent', { ticket: data.tickets[0] });
          });
      } else if (this.hasChildren()){
        this.ajax('fetchTickets', _.pluck(this.ancestry().children, 'id'))
          .done(function(data){
            this.switchTo('children', { tickets: data.tickets });
          });
      }
    },

    createSubTasks: function(){
      var tasks = this.configuration()
        .templates[this.selectedTaskTemplate()]
        .tasks;

      this.subTaskToCreate = tasks.length;

      _.each(tasks, function(task_name){
        this.createSubTask(task_name);
      }, this);
    },

    createSubTask: function(task_name){
      var task = this.configuration().tasks[task_name];

      var taskJson = taskAsJson({
        task: task,
        ticket: this.ticket(),
        data_field: this.setting('data_field')
      });

      this.ajax('createSubTask', taskJson).done(function(data){
        this.currentAncestry.children.push({
          name: task.label,
          id: data.ticket.id
        });

        this.createdTickets.push(data.ticket);

        if ((this.createdSubTask += 1) === this.subTaskToCreate){
          this.saveCurrentAncestry();
          this.subTaskToCreate = 0;
          this.switchTo('children', { tickets: this.createdTickets });
        }
      });
    },

    saveCurrentAncestry: function(){
      var stringified_ancestry = JSON.stringify(this.currentAncestry);
      var data = { ticket: { fields: {} } };

      this.ticket().customField('custom_field_' + this.setting('data_field'),
                                stringified_ancestry);

      data.ticket.fields[Number(this.setting('data_field'))] = stringified_ancestry;

      this.ajax('updateTicket', { id: this.ticket().id(), data: data });
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
