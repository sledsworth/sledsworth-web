  function numberToMonth(month) {
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ][parseInt(month) - 1]
  }

  /**
   * Makes a friendly date from date object.
   *
   * @param {year: string, month: string, day: string} dateObject
   *
   * @returns {string} nicely formated, readable date (September 30, 1989)
   */
  function getDisplayDate({
    year,
    month,
    day
  }) {
    return `${numberToMonth(month)} ${parseInt(day)}, ${year}`
  }

  /**
   * Takes a file path of the form year/month/day/title.md and returns a date object form it.
   *
   * @param {string} filePath path to file in the form of year/month/day/title-of-post.md
   *
   * @returns {
   * year,
   * month,
   * day
   * } object of the year, month, and day
   */
  function filePathToDate(filePath) {
    const [year, month, day] = filePath.split(/[/]/g)
    return {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
    }
  }

  function getDateFromFilePath(path) {
    const date = filePathToDate(path)
    return {
      ...date,
      display: getDisplayDate(date),
    }
  }

  module.exports = {
    numberToMonth,
    getDisplayDate,
    getDateFromFilePath,
  }