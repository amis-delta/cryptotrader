balChartOptions = {
  jack: {
    yAxis: {
      title: {
        text: 'Dollar Value'
      },
      tickPositioner: function() {
        let positions = [0, .1, .2, .3, .4, .5];
        return positions;
      },
      floor: 0,
      // ceiling: .5,
    }
  },
  will: {
    yAxis: {
      title: {
        text: 'Dollar Value'
      }
    }
  }
}
