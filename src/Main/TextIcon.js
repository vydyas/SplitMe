import React from 'react';
import pure from 'recompose/pure';
import {grey500} from 'material-ui/src/styles/colors';

const styles = {
  root: {
    display: 'flex',
    color: grey500,
    fontSize: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    padding: 25,
    height: '65vh',
    textAlign: 'center',
    boxSizing: 'border-box',
  },
  icon: {
    width: '35%',
    maxWidth: 150,
    height: 150,
    marginBottom: 30,
    display: 'block',
  },
};

class TextIcon extends React.Component {
  static propTypes = {
    icon: React.PropTypes.string,
    text: React.PropTypes.string,
  };

  render() {
    const {
      text,
      icon,
    } = this.props;

    return (
      <div style={styles.root}>
        <img src={icon} style={styles.icon} />
        {text}
      </div>
    );
  }
}

export default pure(TextIcon);
