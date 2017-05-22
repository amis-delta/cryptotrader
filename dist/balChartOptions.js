balChartOptions = {
  jack: {
    yAxis: {
      title: {
        text: 'Dollar Value'
      },
      tickPositioner: function() {
        let positions = [];
        let incr = .1;
        let ticks = 10;

        for (var i = 0; i <= ticks; i++) {
          positions.push(parseFloat((incr * i).toFixed(1)));
        }

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
