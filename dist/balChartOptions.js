balChartOptions = {
  jack: {
    yAxis: {
      title: {
        text: 'Dollar Value'
      },
      tickPositioner: function() {
        let positions = [];
        let incr = .2;
        let ticks = 20;

        for (var i = 0; i <= ticks; i++) {
          positions.push(parseFloat((incr * i).toFixed(1)));
        }

        return positions;
      },
      floor: 0,
      // ceiling: .5,
    }
  },
  default: {
    yAxis: {
      title: {
        text: 'Dollar Value'
      }
    }
  }
}
