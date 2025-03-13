#   LeonardSchlenker(447824)    PauAzpeitia(443428) FangdiJin(346724) 
#	Freitag, 27. Oktober 2023
import os


class Transitions(dict):
    def __str__(self):
        out_str = ''
        for key, value in self.items():
            out_str += f'{key} -> {value}\n'
        return out_str


class Band:
    def __init__(self, prev, next, symbol: str) -> None:
        self.prev = prev
        self.next = next
        self.symbol = symbol

    def __str__(self):
        temp = self
        out_str = ''
        while temp.prev is not None:
            temp = temp.prev
        while temp is not None:
            out_str += temp.symbol
            temp = temp.next
        return out_str

    def get_next(self):
        if self.next is None:
            self.next = Band(self, None, 'B')
        return self.next

    def get_prev(self):
        if self.prev is None:
            self.prev = Band(None, self, 'B')
        return self.prev

    def get_symbol(self) -> str:
        return self.symbol

    def set_symbol(self, symbol: str) -> None:
        self.symbol = symbol


class TuringMachine:
    def __init__(self, path: str) -> None:
        if not os.path.exists(path):
            raise FileNotFoundError("File not found")
        with open(path, "r") as tm_file:
            # number of states in the machine as int
            self.state_num = int(tm_file.readline().strip())
            # alphabet of the machine as string
            self.input_alphabet = tm_file.readline().strip()
            # alphabet of the tape as string
            self.tape_alphabet = tm_file.readline().strip()
            # blank symbol of the tape
            self.blank_symbol = 'B'
            # initial state of the machine as int
            self.initial_state = int(tm_file.readline().strip())
            # final state of the machine as int
            self.final_state = int(tm_file.readline().strip())
            # transitions of the machine as dictionary
            self.transitions = Transitions()
            for line in tm_file:
                if line[0] == '#':
                    continue
                line = line.strip().split(' ')
                self.transitions[(int(line[0]), line[1])] = (int(line[2]), line[3], line[4])
            # current configuration of the machine as tuple
            self.configuration = (self.initial_state, None)
            # current band of the machine as Band

    def _init_band(self, input: str) -> None:
        self.band = Band(None, None, 'B')
        temp = self.band
        for i in input:
            temp.next = Band(temp, None, i)
            temp = temp.next
        temp.next = Band(temp, None, 'B')
        self.band = self.band.next

    def __str__(self):
        return str(self.configuration)

    def simulate(self, input: str) -> str:
        self._init_band(input)
        for i in input:
            if i not in self.input_alphabet:
                raise ValueError("Invalid input")
        self.configuration = (self.initial_state, input[0])
        while self.configuration[0] != self.final_state:
            print(self.band_str())
            next_configuration = self.transitions[self.configuration]
            self.band.set_symbol(next_configuration[1])
            if next_configuration[2] == 'L':
                self.band = self.band.get_prev()
            if next_configuration[2] == 'R':
                self.band = self.band.get_next()
            self.configuration = (next_configuration[0], self.band.get_symbol())
        print(self.band_str())
        return self.band_str()

    def band_str(self) -> str:
        temp = self.band
        index = 0
        out_str = '...'
        while temp.prev is not None:
            index += 1
            temp = temp.prev
        while temp is not None:
            if index == 0:
                out_str += '[' + str(self.configuration[0]) + ']'
            out_str += temp.symbol
            temp = temp.next
            index -= 1
        return out_str + '...'

    def output(self) -> str:
        out_str = ''
        temp = self.band
        while temp is not None:
            out_str += temp.symbol
            temp = temp.next
        return out_str
