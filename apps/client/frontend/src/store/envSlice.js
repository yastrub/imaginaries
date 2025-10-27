import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isTerminalApp: false,
  terminalName: '',
};

const envSlice = createSlice({
  name: 'env',
  initialState,
  reducers: {
    setIsTerminalApp(state, action) {
      state.isTerminalApp = !!action.payload;
    },
    setTerminalName(state, action) {
      state.terminalName = typeof action.payload === 'string' ? action.payload : '';
    },
  },
});

export const { setIsTerminalApp, setTerminalName } = envSlice.actions;
export default envSlice.reducer;
